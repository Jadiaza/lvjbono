/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LockKeyhole, MessageCircle, Search, Share2, TicketCheck } from "lucide-react";
import { toast } from "sonner";
import { getPublicSellerPage, reservePublicSellerBono } from "@/lib/seller-public.functions";
import { padBonoNumber } from "@/lib/bono-domain";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCOP } from "@/lib/format";

export const Route = createFileRoute("/vendedor/$slug")({ component: SellerPage });

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function SellerPage() {
  const { slug } = Route.useParams();
  const get = useServerFn(getPublicSellerPage);
  const reserve = useServerFn(reservePublicSellerBono);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"available" | "all">("available");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<any | null>(null);
  const [buyer, setBuyer] = useState({ buyer_name: "", buyer_phone: "", buyer_city: "", buyer_notes: "" });

  const { data, error } = useQuery({
    queryKey: ["seller-public", slug],
    queryFn: () => get({ data: { slug } }),
    retry: false,
  });

  const bonos = data?.bonos ?? [];
  const campaign = bonos[0]?.raffles ?? null;
  const visibleBonos = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bonos.filter((bono: any) => {
      const available = bono.status === "asignado";
      if (filter === "available" && !available) return false;
      if (!term) return true;
      const serial = padBonoNumber(bono.serial);
      const numbers = (bono.raffle_bono_numbers ?? []).map((item: any) => padBonoNumber(item.numero));
      return serial.includes(term) || numbers.some((number: string) => number.includes(term));
    });
  }, [bonos, filter, search]);

  if (error) return <main className="grid min-h-screen place-items-center p-6 text-center"><div><h1 className="text-xl font-bold">Página no disponible</h1><p className="mt-2 text-sm text-muted-foreground">Verifica el enlace o consulta al responsable.</p></div></main>;
  if (!data) return <main className="grid min-h-screen place-items-center p-6 text-center">Cargando…</main>;

  const availableCount = bonos.filter((bono: any) => bono.status === "asignado").length;
  const accent = campaign?.bono_accent_color || "#B8860B";
  const numberColor = campaign?.bono_number_color || "#C51B1B";

  function getNumbers(bono: any) {
    return [...(bono.raffle_bono_numbers ?? [])].sort((a: any, b: any) => a.option_number - b.option_number).map((item: any) => padBonoNumber(item.numero));
  }

  function whatsappUrl(bono: any, reserved = false) {
    if (!data.responsible.phone) return null;
    const nums = getNumbers(bono);
    const text = encodeURIComponent(
      reserved
        ? `Hola ${data.responsible.display_name}, ya reservé el Bono ${padBonoNumber(bono.serial)} con los números ${nums.join(" y ")} desde tu página. Mi nombre es ${buyer.buyer_name}. Quiero coordinar el pago.`
        : `Hola ${data.responsible.display_name}, quiero información sobre el Bono ${padBonoNumber(bono.serial)} con los números ${nums.join(" y ")}.`,
    );
    return `https://wa.me/${data.responsible.phone.replace(/\D/g, "")}?text=${text}`;
  }

  async function shareBono(bono: any) {
    const nums = getNumbers(bono);
    const text = `Bono ${padBonoNumber(bono.serial)} · ${nums.join(" / ")} · ${campaign?.nombre ?? "Bono"}`;
    if (navigator.share) {
      await navigator.share({ title: campaign?.nombre ?? "Bono", text, url: window.location.href });
      return;
    }
    await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
    toast.success("Enlace del bono copiado.");
  }

  async function submitPublicReservation(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      const result = await reserve({ data: { slug, bonoId: selected.id, ...buyer } });
      setConfirmation({ ...result, selected });
      setReserveOpen(false);
      await qc.invalidateQueries({ queryKey: ["seller-public", slug] });
      toast.success(`Bono ${padBonoNumber(selected.serial)} reservado correctamente.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No fue posible reservar el bono.");
      await qc.invalidateQueries({ queryKey: ["seller-public", slug] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background">
      <section className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
          <div className="mb-4 flex justify-end">
            <Button type="button" size="sm" variant="outline" onClick={() => setAccessOpen(true)}>
              <LockKeyhole className="mr-2 h-4 w-4" /> Acceso interno
            </Button>
          </div>
          <div className="grid gap-5 md:grid-cols-[1fr_260px] md:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                {campaign?.bono_logo_url ? <img src={campaign.bono_logo_url} alt="Logo" className="h-14 w-14 shrink-0 rounded-xl object-contain" /> : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-secondary"><TicketCheck className="h-7 w-7" style={{ color: accent }} /></div>}
                <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.18em]" style={{ color: accent }}>{campaign?.bono_title || "BONO"}</p><h1 className="break-words text-2xl font-black leading-tight sm:text-3xl">{campaign?.bono_subtitle || campaign?.nombre || "Bonos disponibles"}</h1></div>
              </div>
              <div className="mt-4 grid gap-1 text-sm sm:grid-cols-2 sm:text-base">
                <p><strong>Responsable:</strong> {data.responsible.display_name}</p>
                {campaign?.valor_boleta ? <p><strong>Valor:</strong> {formatCOP(campaign.valor_boleta)}</p> : null}
                {campaign?.fecha_sorteo ? <p><strong>Sorteo:</strong> {formatDate(campaign.fecha_sorteo)}</p> : null}
                {campaign?.loteria ? <p><strong>Lotería:</strong> {campaign.loteria}</p> : null}
              </div>
            </div>
            <div className="rounded-2xl border bg-background p-4 text-center">
              {campaign?.bono_prize_image_url ? <img src={campaign.bono_prize_image_url} alt={campaign.bono_prize_name || "Premio"} className="mx-auto h-32 w-full object-contain" /> : null}
              <p className="mt-2 text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>Premio</p>
              <p className="font-bold">{campaign?.bono_prize_name || "Premio especial"}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
        <div className="mb-4 rounded-2xl border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-lg font-black">Elige tu bono</h2><p className="text-sm text-muted-foreground">{availableCount} disponibles de {bonos.length} asignados</p></div>
            <div className="flex gap-2"><Button size="sm" variant={filter === "available" ? "default" : "outline"} onClick={() => setFilter("available")}>Disponibles</Button><Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Todos</Button></div>
          </div>
          <div className="relative mt-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por bono o número…" className="pl-9" /></div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleBonos.map((bono: any) => {
            const nums = getNumbers(bono);
            const available = bono.status === "asignado";
            return <button key={bono.id} type="button" onClick={() => { setSelected(bono); setConfirmation(null); }} className={`w-full rounded-2xl border-2 bg-card p-4 text-left transition active:scale-[.99] ${available ? "shadow-sm hover:shadow-md" : "opacity-60"}`} style={{ borderColor: available ? `${accent}88` : undefined }}>
              <div className="flex items-center justify-between gap-3"><strong className="text-base">Bono {padBonoNumber(bono.serial)}</strong><span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold uppercase">{available ? "Disponible" : "No disponible"}</span></div>
              <div className="mt-4 flex items-center justify-center gap-3 text-center">{nums.map((number: string) => <span key={number} className="min-w-0 flex-1 rounded-xl bg-background px-2 py-3 text-3xl font-black tracking-wider" style={{ color: numberColor }}>{number}</span>)}</div>
              <div className="mt-3 text-center text-xs font-semibold">{available ? "Toca para reservar" : "Toca para ver"}</div>
            </button>;
          })}
        </div>
        {!visibleBonos.length && <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">No encontramos bonos con ese filtro.</div>}
      </section>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) { setSelected(null); setConfirmation(null); } }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-2xl p-0">
          {selected && <div className="p-5" style={{ borderTop: `6px solid ${accent}` }}>
            <DialogHeader><DialogTitle>Bono {padBonoNumber(selected.serial)}</DialogTitle></DialogHeader>
            <div className="mt-4 grid grid-cols-2 gap-3">{getNumbers(selected).map((number: string) => <div key={number} className="rounded-2xl border bg-background p-4 text-center"><div className="text-xs font-bold uppercase text-muted-foreground">Número</div><div className="mt-1 text-4xl font-black tracking-wider" style={{ color: numberColor }}>{number}</div></div>)}</div>
            <div className="mt-4 rounded-xl bg-secondary p-3 text-sm"><p><strong>Estado:</strong> {selected.status === "asignado" ? "Disponible" : "No disponible"}</p>{campaign?.valor_boleta ? <p><strong>Valor:</strong> {formatCOP(campaign.valor_boleta)}</p> : null}</div>

            {confirmation ? <div className="mt-5 space-y-3"><div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900"><p className="font-bold">¡Reserva realizada!</p><p>El Bono {padBonoNumber(selected.serial)} quedó reservado a nombre de {buyer.buyer_name}.</p><p className="mt-1">Ahora puedes coordinar el pago con {data.responsible.display_name}.</p></div>{whatsappUrl(selected, true) && <a href={whatsappUrl(selected, true)!} target="_blank" rel="noreferrer"><Button className="w-full"><MessageCircle className="mr-2 h-4 w-4" /> Continuar por WhatsApp</Button></a>}</div> : <div className="mt-5 grid gap-2">{selected.status === "asignado" && <Button className="w-full" onClick={() => setReserveOpen(true)}>Reservar este bono</Button>}<Button variant="outline" className="w-full" onClick={() => shareBono(selected)}><Share2 className="mr-2 h-4 w-4" /> Compartir bono</Button></div>}
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={reserveOpen} onOpenChange={setReserveOpen}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Reserva tu bono</DialogTitle></DialogHeader><form className="space-y-3" onSubmit={submitPublicReservation}>
          <div><Label>Nombre completo *</Label><Input required minLength={2} value={buyer.buyer_name} onChange={(e) => setBuyer({ ...buyer, buyer_name: e.target.value })} /></div>
          <div><Label>Teléfono / WhatsApp *</Label><Input required minLength={7} inputMode="tel" value={buyer.buyer_phone} onChange={(e) => setBuyer({ ...buyer, buyer_phone: e.target.value })} /></div>
          <div><Label>Ciudad</Label><Input value={buyer.buyer_city} onChange={(e) => setBuyer({ ...buyer, buyer_city: e.target.value })} /></div>
          <div><Label>Observación</Label><Input value={buyer.buyer_notes} onChange={(e) => setBuyer({ ...buyer, buyer_notes: e.target.value })} /></div>
          <Button className="w-full" disabled={busy}>{busy ? "Reservando…" : `Confirmar reserva del Bono ${selected ? padBonoNumber(selected.serial) : ""}`}</Button>
        </form></DialogContent>
      </Dialog>

      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Acceso interno</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Selecciona el panel al que deseas ingresar.</p><div className="grid gap-2"><a href="/responsable-login"><Button className="w-full">Panel del responsable</Button></a><a href="/auth"><Button variant="outline" className="w-full">Administración general</Button></a></div></DialogContent>
      </Dialog>
    </main>
  );
}
