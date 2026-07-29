import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, ImageDown, MessageCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { buildWhatsAppUrl, formatCOP, formatDate, padNumber } from "@/lib/format";
import { RaffleShareCard } from "@/components/raffle-share-card";
import { getPublicSkinDefinition } from "@/lib/public-skins";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ReportTicket = {
  numero: number;
  estado: string;
  nombre: string | null;
  telefono: string | null;
  valor_pagado: number | null;
  total_abonado: number;
  codigo_verificacion: string;
};

type ReportRaffle = {
  nombre: string;
  serie: string | null;
  digitos: number;
  valor_boleta: number;
  fecha_sorteo: string | null;
  loteria: string | null;
  premio_mayor: number;
  premio_seco1: number;
  premio_seco2: number;
  premio_aprox_ant: number;
  premio_aprox_pos: number;
  public_skin: string | null;
};

export function AdminSalesTools({
  raffle,
  tickets,
}: {
  raffle: ReportRaffle;
  tickets: ReportTicket[];
}) {
  const posterRef = useRef<HTMLDivElement>(null);
  const shareRaffle = { ...raffle, public_skin: getPublicSkinDefinition(raffle.public_skin).id };
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const occupied = tickets.filter((ticket) => ticket.estado !== "disponible");
  const paid = occupied.filter(
    (ticket) => ticket.total_abonado >= (ticket.valor_pagado ?? raffle.valor_boleta),
  );
  const paying = occupied.filter(
    (ticket) =>
      ticket.total_abonado > 0 &&
      ticket.total_abonado < (ticket.valor_pagado ?? raffle.valor_boleta),
  );
  const unpaid = occupied.filter((ticket) => ticket.total_abonado <= 0);
  const collected = occupied.reduce((sum, ticket) => sum + (ticket.total_abonado ?? 0), 0);
  const pending = occupied.reduce(
    (sum, ticket) =>
      sum + Math.max(0, (ticket.valor_pagado ?? raffle.valor_boleta) - (ticket.total_abonado ?? 0)),
    0,
  );

  function paymentLabel(ticket: ReportTicket) {
    const value = ticket.valor_pagado ?? raffle.valor_boleta;
    if (ticket.total_abonado >= value) return "Pagado";
    if (ticket.total_abonado > 0) return "Abonando";
    return "Sin pago";
  }

  function reminderMessage(ticket: ReportTicket) {
    const value = ticket.valor_pagado ?? raffle.valor_boleta;
    const balance = Math.max(0, value - (ticket.total_abonado ?? 0));
    const number = padNumber(ticket.numero, raffle.digitos === 3 ? 3 : 2);
    return [
      `Hola ${ticket.nombre ?? ""}. Te recordamos los datos de tu boleta.`,
      "",
      `Rifa: *${raffle.nombre}*${raffle.serie ? ` - Serie ${raffle.serie}` : ""}`,
      `Numero: *${number}*`,
      `Juega: *${formatDate(raffle.fecha_sorteo)}*${raffle.loteria ? ` con ${raffle.loteria}` : ""}`,
      `Valor de la boleta: *${formatCOP(value)}*`,
      `Total pagado: *${formatCOP(ticket.total_abonado ?? 0)}*`,
      `Saldo pendiente: *${formatCOP(balance)}*`,
      `Codigo: ${ticket.codigo_verificacion}`,
      `Ver boleta: ${window.location.origin}/boleta/${ticket.codigo_verificacion}`,
      "",
      balance > 0
        ? "Por favor realiza tu pago para mantener la boleta al dia."
        : "Tu boleta se encuentra al dia. Gracias.",
    ].join("\n");
  }

  async function generatePosterImage() {
    if (!posterRef.current) return null;
    const dataUrl = await toPng(posterRef.current, {
      cacheBust: true,
      pixelRatio: raffle.digitos === 3 ? 1 : 1.5,
    });
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File(
      [blob],
      `carton-${raffle.nombre.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.png`,
      { type: "image/png" },
    );
    return { dataUrl, file };
  }

  async function downloadPoster() {
    setGenerating(true);
    try {
      const generated = await generatePosterImage();
      if (!generated) return;
      const link = document.createElement("a");
      link.href = generated.dataUrl;
      link.download = generated.file.name;
      link.click();
      toast.success("Cartón descargado en el dispositivo.");
    } catch {
      toast.error("No fue posible descargar la imagen del cartón.");
    } finally {
      setGenerating(false);
    }
  }

  async function sendPosterToWhatsApp() {
    setGenerating(true);
    try {
      const generated = await generatePosterImage();
      if (!generated) return;
      const text = `Cartón actualizado de ${raffle.nombre}`;
      const shareData = { files: [generated.file], title: raffle.nombre, text };
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return;
      }
      const link = document.createElement("a");
      link.href = generated.dataUrl;
      link.download = generated.file.name;
      link.click();
      window.open(buildWhatsAppUrl("", text), "_blank", "noopener");
      toast.success("Cartón descargado. Adjunta en el chat de WhatsApp.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("No fue posible compartir la imagen del cartón.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 font-semibold">
            <Users className="h-5 w-5 text-brand" /> Reporte de ventas y pagos
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Consulta el estado y envia recordatorios individuales por WhatsApp.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <ImageDown className="mr-2 h-4 w-4" /> Generar carton en imagen
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Metric label="Boletas ocupadas" value={String(occupied.length)} />
        <Metric label="Pagadas" value={String(paid.length)} tone="text-success" />
        <Metric label="Abonando" value={String(paying.length)} tone="text-warning" />
        <Metric label="Sin pago" value={String(unpaid.length)} tone="text-destructive" />
        <Metric label="Saldo pendiente" value={formatCOP(pending)} tone="text-warning" />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Recaudado: <strong className="text-foreground">{formatCOP(collected)}</strong>
      </p>

      <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 bg-secondary text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Numero</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Pagado</th>
              <th className="px-3 py-2">Pendiente</th>
              <th className="px-3 py-2">Recordatorio</th>
            </tr>
          </thead>
          <tbody>
            {occupied.map((ticket) => {
              const value = ticket.valor_pagado ?? raffle.valor_boleta;
              const balance = Math.max(0, value - (ticket.total_abonado ?? 0));
              return (
                <tr key={ticket.codigo_verificacion} className="border-t border-border">
                  <td className="px-3 py-2 font-display text-lg text-brand">
                    {padNumber(ticket.numero, raffle.digitos === 3 ? 3 : 2)}
                  </td>
                  <td className="px-3 py-2">
                    <strong>{ticket.nombre ?? "Sin nombre"}</strong>
                    <small className="block text-muted-foreground">
                      {ticket.telefono ?? "Sin telefono"}
                    </small>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-secondary px-2 py-1 text-xs font-semibold">
                      {paymentLabel(ticket)}
                    </span>
                  </td>
                  <td className="px-3 py-2">{formatCOP(ticket.total_abonado ?? 0)}</td>
                  <td className="px-3 py-2 font-semibold">{formatCOP(balance)}</td>
                  <td className="px-3 py-2">
                    {ticket.telefono ? (
                      <a
                        href={buildWhatsAppUrl(ticket.telefono, reminderMessage(ticket))}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-[#25D366] px-2.5 py-1.5 text-xs font-bold text-white hover:brightness-95"
                      >
                        <MessageCircle className="h-4 w-4" /> WhatsApp
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin telefono</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="grid max-h-[94dvh] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Carton para compartir por WhatsApp</DialogTitle>
            <DialogDescription>
              Incluye los numeros y estados actuales con el skin de esta rifa.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-auto rounded-xl border border-border bg-secondary/30 p-3">
            <RaffleShareCard ref={posterRef} raffle={shareRaffle} tickets={tickets} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
            <Button variant="outline" onClick={downloadPoster} disabled={generating}>
              <Download className="mr-2 h-4 w-4" /> Descargar PNG
            </Button>
            <Button
              onClick={sendPosterToWhatsApp}
              disabled={generating}
              className="bg-[#25D366] font-semibold text-white hover:bg-[#20bd5a]"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              {generating ? "Generando..." : "Enviar por WhatsApp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl bg-secondary/60 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`font-display text-xl ${tone}`}>{value}</p>
    </div>
  );
}
