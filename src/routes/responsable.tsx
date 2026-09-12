/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Eye, KeyRound, LogOut, Search, Share2, Undo2 } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { responsibleGetDashboard, responsibleUpdateBonos } from "@/lib/bono.functions";
import { responsibleGetOfferBatches } from "@/lib/bono-batch.functions";
import {
  responsibleCancelBonoReservation,
  responsibleReserveBono,
  responsibleRevertBonoSale,
} from "@/lib/responsible-bono-sales.functions";
import { supabase } from "@/integrations/supabase/client";
import { BonoBatchCard } from "@/components/bono-batch-card";
import { BonoDualCard } from "@/components/bono-dual-card";
import { ResponsibleBuyersTable } from "@/components/responsible-buyers-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { padBonoNumber } from "@/lib/bono-domain";

export const Route = createFileRoute("/responsable")({ component: ResponsibleDashboard });

const AVAILABLE = new Set(["asignado", "disponible", "devuelto"]);

function normalizeWhatsAppPhone(value?: string | null) {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("57") && digits.length >= 12) return digits;
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
  return digits;
}

function ResponsibleDashboard() {
  const navigate = useNavigate();
  const get = useServerFn(responsibleGetDashboard);
  const getOfferBatches = useServerFn(responsibleGetOfferBatches);
  const update = useServerFn(responsibleUpdateBonos);
  const reserve = useServerFn(responsibleReserveBono);
  const cancelReservation = useServerFn(responsibleCancelBonoReservation);
  const revertSale = useServerFn(responsibleRevertBonoSale);
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["responsible-dashboard"], queryFn: () => get(), retry: false });
  const { data: offerData } = useQuery({ queryKey: ["responsible-offer-batches"], queryFn: () => getOfferBatches(), retry: false });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"disponibles" | "reservados" | "vendidos" | "pagados" | "todos">("disponibles");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBono, setSelectedBono] = useState<any | null>(null);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ password: "", confirmPassword: "" });
  const [busy, setBusy] = useState(false);
  const [customer, setCustomer] = useState({ buyer_name: "", buyer_phone: "", buyer_city: "", buyer_notes: "" });
  const [payment, setPayment] = useState({ amount_paid: "", payment_reference: "" });
  const exportRef = useRef<HTMLDivElement>(null);
  const individualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) {
      toast.error(error instanceof Error ? error.message : "Acceso denegado");
      navigate({ to: "/responsable-login", replace: true });
    }
  }, [error, navigate]);

  useEffect(() => {
    if (!selectedBatchId && offerData?.batches?.length) setSelectedBatchId(offerData.batches[0].id);
  }, [offerData?.batches, selectedBatchId]);

  const bonos = data?.bonos ?? [];
  const filtered = useMemo(() => bonos.filter((b: any) => {
    const matchesFilter =
      filter === "todos" ||
      (filter === "disponibles" && AVAILABLE.has(b.status)) ||
      (filter === "reservados" && b.status === "reservado") ||
      (filter === "vendidos" && b.status === "vendido") ||
      (filter === "pagados" && b.status === "pagado");
    const q = search.trim();
    const matchesSearch = !q || padBonoNumber(b.serial).includes(q) || b.raffle_bono_numbers?.some((n: any) => padBonoNumber(n.numero).includes(q));
    return matchesFilter && matchesSearch;
  }), [bonos, filter, search]);

  const selectedBatch = useMemo(
    () => offerData?.batches?.find((batch: any) => batch.id === selectedBatchId) ?? null,
    [offerData?.batches, selectedBatchId],
  );

  const raffleById = (raffleId: string) => offerData?.batches?.find((batch: any) => batch.raffle.id === raffleId)?.raffle ?? null;

  const selectedRaffle = useMemo(() => {
    if (!selectedBono) return null;
    return raffleById(selectedBono.raffle_id) ?? selectedBatch?.raffle ?? null;
  }, [offerData?.batches, selectedBono, selectedBatch]);

  function openBono(bono: any) {
    const raffle = raffleById(bono.raffle_id) ?? selectedBatch?.raffle ?? null;
    setSelectedBono(bono);
    setCustomer({
      buyer_name: bono.buyer_name ?? "",
      buyer_phone: bono.buyer_phone ?? "",
      buyer_city: bono.buyer_city ?? "",
      buyer_notes: bono.buyer_notes ?? "",
    });
    setPayment({ amount_paid: String(bono.amount_paid || raffle?.valor_boleta || ""), payment_reference: bono.payment_reference ?? "" });
  }

  function openPaymentFor(bono: any) {
    openBono(bono);
    setPayOpen(true);
  }

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["responsible-dashboard"] });
    await qc.invalidateQueries({ queryKey: ["responsible-offer-batches"] });
  }

  async function submitPasswordChange(event: React.FormEvent) {
    event.preventDefault();
    if (passwordForm.password.length < 8) return toast.error("La nueva contraseña debe tener al menos 8 caracteres.");
    if (passwordForm.password !== passwordForm.confirmPassword) return toast.error("Las contraseñas no coinciden.");
    setChangingPassword(true);
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password: passwordForm.password });
      if (passwordError) throw passwordError;
      toast.success("Contraseña actualizada. Ingresa nuevamente con tu nueva contraseña.");
      setPasswordOpen(false);
      setPasswordForm({ password: "", confirmPassword: "" });
      await supabase.auth.signOut();
      navigate({ to: "/responsable-login", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No fue posible cambiar la contraseña.");
    } finally { setChangingPassword(false); }
  }

  async function submitReservation(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedBono) return;
    setBusy(true);
    try {
      await reserve({ data: { bonoId: selectedBono.id, ...customer } });
      toast.success("Bono reservado correctamente.");
      setReserveOpen(false);
      setSelectedBono(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No fue posible reservar el bono.");
    } finally { setBusy(false); }
  }

  async function cancelSelectedReservation() {
    if (!selectedBono || !confirm(`¿Cancelar la reserva del Bono ${padBonoNumber(selectedBono.serial)}?`)) return;
    setBusy(true);
    try {
      await cancelReservation({ data: { bonoId: selectedBono.id } });
      toast.success("Reserva cancelada. El bono vuelve a estar disponible.");
      setSelectedBono(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No fue posible cancelar la reserva.");
    } finally { setBusy(false); }
  }

  async function registerSale() {
    if (!selectedBono) return;
    const buyerName = selectedBono.buyer_name || customer.buyer_name;
    const buyerPhone = selectedBono.buyer_phone || customer.buyer_phone;
    if (!buyerName || !buyerPhone) {
      setReserveOpen(true);
      toast.info("Primero registra los datos del comprador.");
      return;
    }
    setBusy(true);
    try {
      await update({ data: { bonoIds: [selectedBono.id], action: "sell", buyer_name: buyerName, buyer_phone: buyerPhone } });
      toast.success("Venta registrada.");
      setSelectedBono(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No fue posible registrar la venta.");
    } finally { setBusy(false); }
  }

  async function revertSelectedSale() {
    if (!selectedBono || selectedBono.status !== "vendido") return;
    if (!confirm(`¿Revertir la venta del Bono ${padBonoNumber(selectedBono.serial)}? Volverá a RESERVADO y conservará los datos del comprador.`)) return;
    setBusy(true);
    try {
      await revertSale({ data: { bonoId: selectedBono.id } });
      toast.success("Venta revertida. El bono volvió a Reservado.");
      setSelectedBono(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No fue posible revertir la venta.");
    } finally { setBusy(false); }
  }

  async function submitPayment(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedBono) return;
    setBusy(true);
    try {
      await update({ data: { bonoIds: [selectedBono.id], action: "pay", payment_reference: payment.payment_reference || "" } });
      toast.success("Pago registrado.");
      setPayOpen(false);
      setSelectedBono(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No fue posible registrar el pago.");
    } finally { setBusy(false); }
  }

  async function buildBatchImage() {
    if (!exportRef.current || !selectedBatch) return null;
    try {
      return await toPng(exportRef.current, { cacheBust: true, pixelRatio: 1.5, backgroundColor: "#fffaf0" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible generar el cartón.");
      return null;
    }
  }

  async function downloadBatchCard() {
    const dataUrl = await buildBatchImage();
    if (!dataUrl || !selectedBatch) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `carton-${selectedBatch.code}.png`;
    a.click();
  }

  async function shareBatchCard() {
    const dataUrl = await buildBatchImage();
    if (!dataUrl || !selectedBatch) return;
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], `carton-${selectedBatch.code}.png`, { type: "image/png" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ title: selectedBatch.raffle.nombre, text: `${selectedBatch.raffle.nombre} · ${selectedBatch.name || selectedBatch.code}`, files: [file] });
      return;
    }
    await downloadBatchCard();
    toast.info("La imagen se descargó para que puedas compartirla.");
  }

  async function buildIndividualBonoFile() {
    if (!individualRef.current || !selectedBono) return null;
    const dataUrl = await toPng(individualRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
    const blob = await (await fetch(dataUrl)).blob();
    return {
      dataUrl,
      file: new File([blob], `bono-${padBonoNumber(selectedBono.serial)}.png`, { type: "image/png" }),
    };
  }

  async function shareIndividualBono() {
    if (!selectedBono) return;
    try {
      const generated = await buildIndividualBonoFile();
      if (!generated) return;
      const nums = (selectedBono.raffle_bono_numbers ?? []).slice().sort((a: any, b: any) => a.option_number - b.option_number).map((n: any) => padBonoNumber(n.numero)).join(" / ");
      const text = `Bono ${padBonoNumber(selectedBono.serial)} · Números ${nums}`;
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [generated.file] }))) {
        await navigator.share({ title: `Bono ${padBonoNumber(selectedBono.serial)}`, text, files: [generated.file] });
      } else {
        const a = document.createElement("a");
        a.href = generated.dataUrl;
        a.download = generated.file.name;
        a.click();
        toast.info("La imagen del bono se descargó para compartirla.");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error(e instanceof Error ? e.message : "No fue posible generar el bono.");
    }
  }

  async function sendSelectedBonoToWhatsApp() {
    if (!selectedBono?.buyer_phone) return toast.error("Este bono no tiene un WhatsApp registrado.");
    const phone = normalizeWhatsAppPhone(selectedBono.buyer_phone);
    if (!phone) return toast.error("El número de WhatsApp no es válido.");
    try {
      const generated = await buildIndividualBonoFile();
      if (!generated) return;
      const nums = (selectedBono.raffle_bono_numbers ?? []).slice().sort((x: any, y: any) => x.option_number - y.option_number).map((n: any) => padBonoNumber(n.numero)).join(" y ");
      const text = `Hola ${selectedBono.buyer_name || ""}. Te envío tu Bono ${padBonoNumber(selectedBono.serial)}, números ${nums}. Gracias por apoyar la misión de Mensajeros de San Miguel Arcángel.`;

      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [generated.file] }))) {
        await navigator.share({ title: `Bono ${padBonoNumber(selectedBono.serial)}`, text, files: [generated.file] });
        toast.success(`Imagen compartida. WhatsApp registrado: +${phone}.`);
        return;
      }

      const a = document.createElement("a");
      a.href = generated.dataUrl;
      a.download = generated.file.name;
      a.click();
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      toast.info("Tu dispositivo no permite adjuntar la imagen automáticamente. Se descargó el bono y se abrió el WhatsApp registrado para que lo adjuntes.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error(e instanceof Error ? e.message : "No fue posible compartir el bono por WhatsApp.");
    }
  }

  if (!data) return <main className="p-8">Cargando bonos asignados…</main>;
  const s = data.summary;
  const selectedNumbers = selectedBono
    ? (selectedBono.raffle_bono_numbers ?? []).slice().sort((a: any, b: any) => a.option_number - b.option_number).map((n: any) => n.numero)
    : [];

  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-6 p-3 sm:p-6">
      <header className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl text-gold sm:text-2xl">{data.responsible.display_name}</h1>
          <p className="text-sm text-muted-foreground">Mis bonos · ventas y pagos</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setPasswordOpen(true)}><KeyRound className="mr-1 h-4 w-4" /> Cambiar contraseña</Button>
          <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/responsable-login" }); }}><LogOut className="mr-1 h-4 w-4" /> Salir</Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Disponibles", s.counts.asignado ?? 0], ["Reservados", s.counts.reservado ?? 0], ["Vendidos", s.counts.vendido ?? 0], ["Pagados", s.counts.pagado ?? 0]].map(([k, v]) => (
          <button key={String(k)} type="button" onClick={() => setFilter(String(k).toLowerCase() as any)} className="rounded-xl border bg-card p-3 text-left transition hover:border-gold/60"><p className="text-xs text-muted-foreground">{k}</p><strong className="text-xl">{v}</strong></button>
        ))}
      </div>

      <section className="space-y-4 rounded-2xl border bg-card p-3 sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div><h2 className="font-display text-lg sm:text-xl">Cartón para ofrecer</h2><p className="text-sm text-muted-foreground">Toca un bono disponible para administrarlo.</p></div>
          {selectedBatch && <div className="flex gap-2"><Button variant="outline" size="sm" onClick={downloadBatchCard}><Download className="mr-1 h-4 w-4" /> Descargar</Button><Button size="sm" onClick={shareBatchCard}><Share2 className="mr-1 h-4 w-4" /> Compartir</Button></div>}
        </div>
        <div className="flex flex-wrap gap-2">
          {(offerData?.batches ?? []).map((batch: any) => {
            const available = batch.bonos.filter((b: any) => AVAILABLE.has(b.status)).length;
            return <Button key={batch.id} size="sm" variant={selectedBatchId === batch.id ? "default" : "outline"} onClick={() => setSelectedBatchId(batch.id)}><Eye className="mr-1 h-4 w-4" /> {batch.name || batch.code} · {available}/{batch.bonos.length}</Button>;
          })}
        </div>
        {selectedBatch ? <BonoBatchCard raffle={selectedBatch.raffle} batch={{ code: selectedBatch.code, name: selectedBatch.name }} responsibleName={offerData?.responsible?.display_name ?? data.responsible.display_name} bonos={selectedBatch.bonos} onSelectBono={(bono: any) => openBono(bonos.find((b: any) => b.id === bono.id) ?? bono)} /> : <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">No tienes lotes asignados todavía.</p>}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-3 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar bono o número" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <select className="h-10 rounded-md border bg-background px-3" value={filter} onChange={(e) => setFilter(e.target.value as any)}><option value="disponibles">Disponibles</option><option value="reservados">Reservados</option><option value="vendidos">Vendidos</option><option value="pagados">Pagados</option><option value="todos">Todos</option></select>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b: any) => {
            const nums = (b.raffle_bono_numbers ?? []).slice().sort((a: any, c: any) => a.option_number - c.option_number).map((n: any) => padBonoNumber(n.numero));
            return <button type="button" key={b.id} onClick={() => openBono(b)} className="rounded-xl border bg-background p-4 text-left transition hover:border-gold/60 hover:shadow-sm"><div className="flex items-center justify-between"><strong>Bono {padBonoNumber(b.serial)}</strong><span className="rounded-full bg-secondary px-2 py-1 text-[11px] font-bold uppercase">{b.status}</span></div><div className="mt-3 text-2xl font-black text-red-700">{nums.join(" · ")}</div>{b.buyer_name && <p className="mt-2 text-sm"><strong>Comprador:</strong> {b.buyer_name}</p>}</button>;
          })}
        </div>
        {!filtered.length && <p className="p-6 text-center text-sm text-muted-foreground">No hay bonos con este filtro.</p>}
      </section>

      <ResponsibleBuyersTable bonos={bonos} raffleById={raffleById} onOpenBono={openBono} onRegisterPayment={openPaymentFor} />

      <div className="pointer-events-none fixed -left-[5000px] top-0 w-[1200px]">
        {selectedBatch && <BonoBatchCard ref={exportRef} exportMode raffle={selectedBatch.raffle} batch={{ code: selectedBatch.code, name: selectedBatch.name }} responsibleName={offerData?.responsible?.display_name ?? data.responsible.display_name} bonos={selectedBatch.bonos} />}
      </div>

      <Dialog open={Boolean(selectedBono)} onOpenChange={(open) => !open && setSelectedBono(null)}>
        <DialogContent className="max-h-[94vh] max-w-2xl overflow-y-auto p-4 sm:p-6">
          {selectedBono && <><DialogHeader><DialogTitle>Bono {padBonoNumber(selectedBono.serial)}</DialogTitle></DialogHeader>
            {selectedRaffle && <div ref={individualRef}><BonoDualCard statusDisplay="subtle" bono={{ serial: selectedBono.serial, verification_code: selectedBono.verification_code, numbers: selectedNumbers, status: selectedBono.status, raffle: selectedRaffle }} /></div>}
            {selectedBono.buyer_name && <div className="rounded-xl bg-secondary p-3 text-sm"><p><strong>Comprador:</strong> {selectedBono.buyer_name}</p><p><strong>Teléfono:</strong> {selectedBono.buyer_phone || "—"}</p>{selectedBono.buyer_city && <p><strong>Ciudad:</strong> {selectedBono.buyer_city}</p>}</div>}
            <div className="grid gap-2 sm:grid-cols-2">
              {AVAILABLE.has(selectedBono.status) && <Button onClick={() => setReserveOpen(true)}>Reservar este bono</Button>}
              {selectedBono.status === "reservado" && <><Button onClick={registerSale} disabled={busy}>Registrar venta</Button><Button variant="outline" onClick={cancelSelectedReservation} disabled={busy}>Cancelar reserva</Button></>}
              {selectedBono.status === "vendido" && <><Button onClick={() => setPayOpen(true)}>Registrar pago</Button><Button variant="outline" onClick={revertSelectedSale} disabled={busy}><Undo2 className="mr-1 h-4 w-4" /> Revertir venta</Button></>}
              {selectedBono.buyer_phone && <Button onClick={sendSelectedBonoToWhatsApp}><Share2 className="mr-1 h-4 w-4" /> Compartir imagen por WhatsApp</Button>}
              <Button variant="outline" onClick={shareIndividualBono}><Share2 className="mr-1 h-4 w-4" /> Compartir imagen</Button>
            </div>
            <p className="text-xs text-muted-foreground">Cuando el bono está reservado, la imagen muestra únicamente un sello pequeño “Reservado” en la esquina superior izquierda, sin cubrir el diseño.</p>
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={reserveOpen} onOpenChange={setReserveOpen}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>¿A quién se reserva?</DialogTitle></DialogHeader>
          <form onSubmit={submitReservation} className="space-y-3"><Field label="Nombre del comprador *"><Input required minLength={2} value={customer.buyer_name} onChange={(e) => setCustomer({ ...customer, buyer_name: e.target.value })} /></Field><Field label="Teléfono / WhatsApp *"><Input required minLength={7} inputMode="tel" value={customer.buyer_phone} onChange={(e) => setCustomer({ ...customer, buyer_phone: e.target.value })} /></Field><Field label="Ciudad"><Input value={customer.buyer_city} onChange={(e) => setCustomer({ ...customer, buyer_city: e.target.value })} /></Field><Field label="Nota"><Input value={customer.buyer_notes} onChange={(e) => setCustomer({ ...customer, buyer_notes: e.target.value })} /></Field><Button disabled={busy} className="w-full">{busy ? "Guardando…" : "Confirmar reserva"}</Button></form>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
          <form onSubmit={submitPayment} className="space-y-3"><Field label="Valor recibido"><Input inputMode="numeric" value={payment.amount_paid} onChange={(e) => setPayment({ ...payment, amount_paid: e.target.value.replace(/\D/g, "") })} /></Field><Field label="Referencia / comprobante"><Input value={payment.payment_reference} onChange={(e) => setPayment({ ...payment, payment_reference: e.target.value })} /></Field><Button disabled={busy} className="w-full">{busy ? "Guardando…" : "Confirmar pago"}</Button></form>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={(open) => { setPasswordOpen(open); if (!open) setPasswordForm({ password: "", confirmPassword: "" }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cambiar contraseña</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Crea una contraseña personal de al menos 8 caracteres. Después del cambio deberás iniciar sesión nuevamente.</p>
          <form onSubmit={submitPasswordChange} className="space-y-3">
            <Field label="Nueva contraseña"><Input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={passwordForm.password} onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })} /></Field>
            <Field label="Confirmar nueva contraseña"><Input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} /></Field>
            <Button className="w-full" disabled={changingPassword}><KeyRound className="mr-2 h-4 w-4" />{changingPassword ? "Actualizando…" : "Guardar nueva contraseña"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1 block">{label}</Label>{children}</div>;
}
