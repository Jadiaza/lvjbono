import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { getBoletaByCodigo } from "@/lib/raffle.functions";
import { formatCOP, padNumber, formatDate, buildWhatsAppUrl } from "@/lib/format";
import { Printer, CheckCircle2, Clock, XCircle, Trophy, Share2 } from "lucide-react";

export const Route = createFileRoute("/boleta/$codigo")({
  loader: async ({ params }) => {
    const res = await getBoletaByCodigo({ data: { codigo: params.codigo } });
    if (!res) throw notFound();
    return res;
  },
  head: () => ({
    meta: [
      { title: "Mi boleta · ¡Qué Locura de Rifa!" },
      { name: "description", content: "Boleta virtual de participación." },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <p className="text-destructive">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="font-display text-3xl text-gold">Boleta no encontrada</h1>
        <Link to="/" className="mt-4 inline-block text-sm text-gold underline">
          Volver al inicio
        </Link>
      </div>
    </div>
  ),
  component: BoletaPage,
});

function BoletaPage() {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const { ticket, raffle } = Route.useLoaderData() as {
    ticket: {
      numero: number;
      estado: string;
      nombre: string | null;
      telefono: string | null;
      ciudad: string | null;
      email: string | null;
      medio_pago: string | null;
      valor_pagado: number | null;
      fecha_compra: string | null;
      codigo_verificacion: string;
      premio_ganado: string | null;
    };
    raffle: {
      nombre: string;
      digitos: number;
      fecha_sorteo: string | null;
      loteria: string | null;
      whatsapp_admin: string | null;
      nequi: string | null;
      daviplata: string | null;
      bre_b: string | null;
    } | null;
  };
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/boleta/${ticket.codigo_verificacion}`
      : "";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url || ticket.codigo_verificacion)}`;

  const badge = {
    reservado: {
      icon: Clock,
      text: "Reservado — pendiente de pago",
      className: "bg-warning text-warning-foreground",
    },
    vendido: {
      icon: CheckCircle2,
      text: "Pago confirmado",
      className: "bg-success text-success-foreground",
    },
    ganador: {
      icon: Trophy,
      text: `¡GANADOR! ${ticket.premio_ganado ?? ""}`,
      className: "bg-gold-gradient text-primary-foreground",
    },
    disponible: {
      icon: XCircle,
      text: "Anulada",
      className: "bg-destructive text-destructive-foreground",
    },
  }[ticket.estado] ?? { icon: Clock, text: ticket.estado, className: "bg-muted" };
  const BadgeIcon = badge.icon;
  const ticketNumber = padNumber(ticket.numero, (raffle?.digitos ?? 2) as 2 | 3);
  const shareMessage = `Boleta ${ticketNumber} de ${raffle?.nombre ?? "la rifa"}. Verificación: ${url}`;

  async function shareTicketImage() {
    if (!ticketRef.current) return;
    setSharing(true);
    try {
      const dataUrl = await toPng(ticketRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `boleta-${ticketNumber}.png`, { type: "image/png" });
      const shareData = { files: [file], title: `Boleta ${ticketNumber}`, text: shareMessage };

      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return;
      }

      const download = document.createElement("a");
      download.href = dataUrl;
      download.download = file.name;
      download.click();
      toast.success("Imagen descargada. Adjúntala en el chat de WhatsApp.");
      if (raffle?.whatsapp_admin) {
        window.open(buildWhatsAppUrl(raffle.whatsapp_admin, shareMessage), "_blank", "noopener");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("[shareTicketImage] Could not generate ticket image", error);
      toast.error("No fue posible generar la imagen de la boleta.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="min-h-screen bg-purple-gradient py-8 px-4 print:bg-white print:py-2">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <Link to="/" className="text-sm text-gold underline">
            ← Volver
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 text-sm text-gold border border-gold/40 rounded px-3 py-1.5 hover:bg-gold/10"
          >
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </button>
        </div>

        <div
          ref={ticketRef}
          className="rounded-3xl overflow-hidden border border-gold/40 bg-card ticket-shadow print:border-black"
        >
          <div className="p-6 bg-gold-gradient text-primary-foreground text-center">
            <p className="text-xs uppercase tracking-[0.3em] opacity-80">Boleta virtual</p>
            <h1 className="font-display text-3xl md:text-4xl mt-1">{raffle?.nombre ?? "Rifa"}</h1>
            <p className="text-sm mt-1 opacity-90">
              {raffle?.loteria ?? ""} · Sorteo {formatDate(raffle?.fecha_sorteo)}
            </p>
          </div>

          <div className="p-6 grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Tu número</p>
              <p className="font-display text-8xl leading-none text-gold">{ticketNumber}</p>
              <div
                className={`inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full text-sm font-semibold ${badge.className}`}
              >
                <BadgeIcon className="h-4 w-4" /> {badge.text}
              </div>
            </div>
            <div className="text-center">
              <img
                src={qrUrl}
                crossOrigin="anonymous"
                alt="QR de verificación"
                width={160}
                height={160}
                className="rounded bg-white p-2 mx-auto"
              />
              <p className="text-[10px] text-muted-foreground mt-1 font-mono break-all max-w-[160px]">
                {ticket.codigo_verificacion.slice(0, 8)}
              </p>
            </div>
          </div>

          <div className="border-t border-dashed border-border grid grid-cols-2 gap-4 p-6 text-sm">
            <Field label="Titular" value={ticket.nombre ?? "—"} />
            <Field label="Teléfono" value={ticket.telefono ?? "—"} />
            <Field label="Ciudad" value={ticket.ciudad ?? "—"} />
            <Field label="Valor pagado" value={formatCOP(ticket.valor_pagado)} />
            <Field label="Fecha compra" value={formatDate(ticket.fecha_compra)} />
            <Field label="Medio de pago" value={ticket.medio_pago ?? "—"} />
          </div>

          <div className="border-t border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Código de verificación:{" "}
            <span className="font-mono text-foreground">{ticket.codigo_verificacion}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={shareTicketImage}
          disabled={sharing}
          className="mt-4 print:hidden w-full inline-flex items-center justify-center gap-2 rounded-md bg-gold-gradient py-3 font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Share2 className="h-5 w-5" />
          {sharing ? "Generando imagen…" : "Compartir boleta por WhatsApp"}
        </button>

        {ticket.estado === "reservado" && raffle?.whatsapp_admin && (
          <a
            href={buildWhatsAppUrl(
              raffle.whatsapp_admin,
              `Hola! Comprobante de pago para el número ${ticketNumber} — código ${ticket.codigo_verificacion}`,
            )}
            target="_blank"
            rel="noreferrer"
            className="mt-3 print:hidden block text-center rounded-md bg-success py-3 font-semibold text-success-foreground"
          >
            Enviar comprobante por WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
