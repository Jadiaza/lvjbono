/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Eye, LogOut, Search, Share2 } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { responsibleGetDashboard, responsibleUpdateBonos } from "@/lib/bono.functions";
import { responsibleGetOfferBatches } from "@/lib/bono-batch.functions";
import {
  responsibleCancelBonoReservation,
  responsibleReserveBono,
} from "@/lib/responsible-bono-sales.functions";
import { supabase } from "@/integrations/supabase/client";
import { BonoBatchCard } from "@/components/bono-batch-card";
import { BonoDualCard } from "@/components/bono-dual-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCOP } from "@/lib/format";
import { padBonoNumber } from "@/lib/bono-domain";

export const Route = createFileRoute("/responsable")({ component: ResponsibleDashboard });

const AVAILABLE = new Set(["asignado", "disponible", "devuelto"]);

function ResponsibleDashboard() {
  const navigate = useNavigate();
  const get = useServerFn(responsibleGetDashboard);
  const getOfferBatches = useServerFn(responsibleGetOfferBatches);
  const update = useServerFn(responsibleUpdateBonos);
  const reserve = useServerFn(responsibleReserveBono);
  const cancelReservation = useServerFn(responsibleCancelBonoReservation);
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["responsible-dashboard"], queryFn: () => get(), retry: false });
  const { data: offerData } = useQuery({ queryKey: ["responsible-offer-batches"], queryFn: () => getOfferBatches(), retry: false });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"disponibles" | "reservados" | "vendidos" | "pagados" | "todos">("disponibles");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBono, setSelectedBono] = useState<any | null>(null);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
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
  const filtered = useMemo(() => {
    return bonos.filter((b: any) => {
      const matchesFilter =
        filter === "todos" ||
        (filter === "disponibles" && AVAILABLE.has(b.status)) ||
        (filter === "reservados" && b.status === "reservado") ||
        (filter === "vendidos" && b.status === "vendido") ||
        (filter === "pagados" && b.status === "pagado");
      const q = search.trim();
      const matchesSearch = !q || padBonoNumber(b.serial).includes(q) || b.raffle_bono_numbers?.some((n: any) => padBonoNumber(n.numero).includes(q));
      return matchesFilter && matchesSearch;
    });
  }, [bonos, filter, search]);

  const selectedBatch = useMemo(
    () => offerData?.batches?.find((batch: any) => batch.id === selectedBatchId) ?? null,
    [offerData?.batches, selectedBatchId],
  );

  const selectedRaffle = useMemo(() => {
    if (!selectedBono) return null;
    return offerData?.batches?.find((batch: any) => batch.raffle.id === selectedBono.raffle_id)?.raffle ?? selectedBatch?.raffle ?? null;
  }, [offerData?.batches, selectedBono, selectedBatch]);

  function openBono(bono: any) {
    setSelectedBono(bono);
    setCustomer({
      buyer_name: bono.buyer_name ?? "",
      buyer_phone: bono.buyer_phone ?? "",
      buyer_city: bono.buyer_city ?? "",
      buyer_notes: bono.buyer_notes ?? "",
    });
    setPayment({ amount_paid: String(bono.amount_paid || selectedRaffle?.valor_boleta || ""), payment_reference: bono.payment_reference ?? "" });
  }

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["responsible-dashboard"] });
    await qc.invalidateQueries({ queryKey: ["responsible-offer-batches"] });
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
    if (!selectedBono) return;
    if (!confirm(`¿Cancelar la reserva del Bono ${padBonoNumber(selectedBono.serial)}?`)) return;
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

  async function shareIndividualBono() {
    if (!individualRef.current || !selectedBono) return;
    try {
      const dataUrl = await toPng(individualRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `bono-${padBonoNumber(selectedBono.serial)}.png`, { type: "image/png" });
      const nums = (selectedBono.raffle_bono_numbers ?? []).sort((a: any, b: any) => a.option_number - b.option_number).map((n: any) => padBonoNumber(n.numero)).join(" / ");
      const text = `Bono ${padBonoNumber(selectedBono.serial)} · Números ${nums}`;
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: `Bono ${padBonoNumber(selectedBono.serial)}`, text, files: [file] });
      } else {
        const a = document.createElement("a"); a.href = dataUrl; a.download = file.name; a.click();
        toast.info("Bono descargado. Puedes enviarlo por WhatsApp.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No fue posible generar el bono.");
    }
  }

  if (!data) return <main className="p-8">Cargando bonos asignados…</main>;
  const s = data.summary;

  const selectedNumbers = selectedBono
    ? (selectedBono.raffle_bono_numbers ?? []).sort((a: any, b: any) => a.option_number - b.option_number).map((n: any) => n.numero)
    : [];

  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-6 p-3 sm:p-6">
      <header className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl text-gold sm:text-2xl">{data.responsible.display_name}</h1>
          <p className="text-sm text-muted-foreground">Mis bonos · ventas y pagos</p>
        </div>
        <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/responsable-login" }); }}>
          <LogOut className="mr-1 h-4 w-4" /> Salir
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Disponibles", s.counts.asignado ?? 0], ["Reservados", s.counts.reservado ?? 0], ["Vendidos", s.counts.vendido ?? 0], ["Pagados", s.counts.pagado ?? 0]].map(([k, v]) => (
          <button key={String(k)} type="button" onClick={() => setFilter(String(k).toLowerCase() as any)} className="rounded-xl border bg-card p-3 text-left transition hover:border-gold/60">
            <p className="text-xs text-muted-foreground">{k}</p><strong className="text-xl">{v}</strong>
          </button>
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
        {selectedBatch ? (
          <BonoBatchCard raffle={selectedBatch.raffle} batch={{ code: selectedBatch.code, name: selectedBatch.name }} responsibleName={offerData?.responsible?.display_name ?? data.responsible.display_name} bonos={selectedBatch.bonos} onSelectBono={(bono: any) => openBono(bonos.find((b: any) => b.id === bono.id) ?? bono)} />
        ) : <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">No tienes lotes asignados todavía.</p>}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-3 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar bono o número" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <select className="h-10 rounded-md border bg-background px-3" value={filter} onChange={(e) => setFilter(e.target.value as any)}><option value="disponibles">Disponibles</option><option value="reservados">Reservados</option><option value="vendidos">Vendidos</option><option value="pagados">Pagados</option><option value="todos">Todos</option></select>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b: any) => {
            const nums = (b.raffle_bono_numbers ?? []).sort((a: any, c: any) => a.option_number - c.option_number).map((n: any) => padBonoNumber(n.numero));
            return <button type="button" key={b.id} onClick={() => openBono(b)} className="rounded-xl border bg-background p-4 text-left transition hover:border-gold/60 hover:shadow-sm"><div className="flex items-center justify-between"><strong>Bono {padBonoNumber(b.serial)}</strong><span className="rounded-full bg-secondary px-2 py-1 text-[11px] font-bold uppercase">{b.status}</span></div><div className="mt-3 text-2xl font-black text-red-700">{nums.join(" · ")}</div>{b.buyer_name && <p className="mt-2 text-sm"><strong>Comprador:</strong> {b.buyer_name}</p>}</button>;
          })}
        </div>
        {!filtered.length && <p className="p-6 text-center text-sm text-muted-foreground">No hay bonos con este filtro.</p>}
      </section>

      <div className="pointer-events-none fixed -left-[5000px] top-0 w-[1200px]">
        {selectedBatch && <BonoBatchCard ref={exportRef} exportMode raffle={selectedBatch.raffle} batch={{ code: selectedBatch.code, name: selectedBatch.name }} responsibleName={offerData?.responsible?.display_name ?? data.responsible.display_name} bonos={selectedBatch.bonos} />}
      </div>

      <Dialog open={Boolean(selectedBono)} onOpenChange={(open) => !open && setSelectedBono(null)}>
        <DialogContent className="max-h-[94vh] max-w-2xl overflow-y-auto p-4 sm:p-6">
          {selectedBono && <><DialogHeader><DialogTitle>Bono {padBonoNumber(selectedBono.serial)}</DialogTitle></DialogHeader>
            {selectedRaffle && <div ref={individualRef}><BonoDualCard bono={{ serial: selectedBono.serial, verification_code: selectedBono.verification_code, numbers: selectedNumbers, status: selectedBono.status, raffle: selectedRaffle }} /></div>}
            {selectedBono.buyer_name && <div className="rounded-xl bg-secondary p-3 text-sm"><p><strong>Comprador:</strong> {selectedBono.buyer_name}</p><p><strong>Teléfono:</strong> {selectedBono.buyer_phone || "—"}</p>{selectedBono.buyer_city && <p><strong>Ciudad:</strong> {selectedBono.buyer_city}</p>}</div>}
            <div className="grid gap-2 sm:grid-cols-2">
              {AVAILABLE.has(selectedBono.status) && <Button onClick={() => setReserveOpen(true)}>Reservar este bono</Button>}
              {selectedBono.status === "reservado" && <><Button onClick={registerSale} disabled={busy}>Registrar venta</Button><Button variant="outline" onClick={cancelSelectedReservation} disabled={busy}>Cancelar reserva</Button></>}
              {selectedBono.status === "vendido" && <Button onClick={() => setPayOpen(true)}>Registrar pago</Button>}
              <Button variant="outline" onClick={shareIndividualBono}><Share2 className="mr-1 h-4 w-4" /> Compartir bono</Button>
            </div>
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
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1 block">{label}</Label>{children}</div>;
}
