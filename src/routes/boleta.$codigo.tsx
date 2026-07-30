import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { getBoletaByCodigo } from "@/lib/raffle.functions";
import { formatCOP, padNumber, formatDate, buildWhatsAppUrl } from "@/lib/format";
import { Printer, CheckCircle2, Clock, XCircle, Trophy, Share2 } from "lucide-react";
import { getPublicSkinDefinition, type PublicSkin } from "@/lib/public-skins";

export const Route = createFileRoute("/boleta/$codigo")({
  loader: async ({ params }) => {
    const res = await getBoletaByCodigo({ data: { codigo: params.codigo } });
    if (!res) throw notFound();
    return res;
  },
  head: () => ({
    meta: [
      { title: "Mi boleta · Rifaya" },
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
  const { ticket, raffle, payments, stages } = Route.useLoaderData() as {
    ticket: {
      id: string;
      numero: number;
      numero_alterno: number | null;
      estado: string;
      nombre: string | null;
      telefono: string | null;
      ciudad: string | null;
      email: string | null;
      medio_pago: string | null;
      valor_pagado: number | null;
      total_abonado: number;
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
      public_skin: PublicSkin;
      valor_boleta: number;
      staged_payments: boolean;
      installment_amount: number | null;
    } | null;
    payments: Array<{ id: string; amount: number; reference: string; paid_at: string }>;
    stages: Array<{
      id: string;
      name: string;
      draw_at: string;
      minimum_paid: number;
      prize_amount: number;
      result_number: number | null;
      winner_ticket_id: string | null;
      completed_at: string | null;
    }>;
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
      className: "ticket-status--reserved",
    },
    vendido: {
      icon: CheckCircle2,
      text: "Pago confirmado",
      className: "ticket-status--sold",
    },
    ganador: {
      icon: Trophy,
      text: `¡GANADOR! ${ticket.premio_ganado ?? ""}`,
      className: "ticket-status--winner",
    },
    disponible: {
      icon: XCircle,
      text: "Anulada",
      className: "ticket-status--void",
    },
  }[ticket.estado] ?? { icon: Clock, text: ticket.estado, className: "ticket-status--reserved" };
  const BadgeIcon = badge.icon;
  const ticketNumber = padNumber(ticket.numero, (raffle?.digitos ?? 2) as 2 | 3);
  const alternateNumber =
    ticket.numero_alterno == null ? null : padNumber(ticket.numero_alterno, 3);
  const totalPaid = ticket.total_abonado ?? 0;
  const ticketValue = raffle?.valor_boleta ?? ticket.valor_pagado ?? 0;
  const isPendingPayment = ticket.estado === "reservado";
  const amountLabel = isPendingPayment
    ? "Valor pendiente"
    : raffle?.staged_payments
      ? "Valor total"
      : "Valor pagado";
  const amountValue = isPendingPayment
    ? Math.max(ticketValue - totalPaid, 0)
    : raffle?.staged_payments
      ? ticketValue
      : (ticket.valor_pagado ?? totalPaid);
  const paymentProgress = ticketValue > 0 ? Math.min(100, (totalPaid / ticketValue) * 100) : 0;

  useEffect(() => {
    if (!raffle?.public_skin) return;
    document.documentElement.dataset.publicActiveSkin = raffle.public_skin;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute("content", getPublicSkinDefinition(raffle.public_skin).colors[0]);
    return () => {
      delete document.documentElement.dataset.publicActiveSkin;
    };
  }, [raffle?.public_skin]);
  const shareMessage = raffle?.staged_payments
    ? `🎟️ Boleta ${raffle.nombre}\n🎯 Número principal: ${ticketNumber}\n🎁 Número alterno: ${alternateNumber ?? "Por asignar"}\n💳 Abonado: ${formatCOP(totalPaid)} de ${formatCOP(ticketValue)}\n🔎 Verificación: ${url}`
    : `Boleta ${ticketNumber} de ${raffle?.nombre ?? "la rifa"}. Verificación: ${url}`;

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

      const download = document.createElement("a");
      download.href = dataUrl;
      download.download = file.name;
      download.click();
      if (ticket.telefono) {
        window.open(buildWhatsAppUrl(ticket.telefono, shareMessage), "_blank", "noopener");
        toast.success("Imagen descargada. Se abrió el chat del comprador para adjuntarla.");
      } else {
        toast.error("Esta boleta no tiene un teléfono de comprador registrado.");
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
    <div
      className="public-ticket-page min-h-screen bg-purple-gradient py-8 px-4 print:bg-white print:py-2"
      data-public-skin={raffle?.public_skin ?? "purpura-real"}
    >
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
          className="ticket-share-card rounded-3xl overflow-hidden border border-gold/40 bg-card ticket-shadow print:border-black"
        >
          <div className="ticket-share-header p-6 bg-gold-gradient text-primary-foreground text-center">
            <p className="text-xs uppercase tracking-[0.3em] opacity-80">Boleta virtual</p>
            <h1 className="font-display text-3xl md:text-4xl mt-1">{raffle?.nombre ?? "Rifa"}</h1>
            <p className="text-sm mt-1 opacity-90">
              {raffle?.loteria ?? ""} · Sorteo {formatDate(raffle?.fecha_sorteo)}
            </p>
          </div>

          <div className="p-6 grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div className="flex flex-col items-center md:items-start">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {raffle?.staged_payments ? "Número principal · Sorteo mayor" : "Tu número"}
              </p>
              <div className="ticket-number-orbit mt-3" aria-label={`Número ${ticketNumber}`}>
                <span>{ticketNumber}</span>
              </div>
              {raffle?.staged_payments && alternateNumber && (
                <div className="mt-4 rounded-2xl border border-brand/30 bg-brand-soft/50 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Número alterno · Premios por etapas
                  </p>
                  <p className="font-display text-4xl text-brand">{alternateNumber}</p>
                </div>
              )}
              <div
                className={`ticket-status inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full text-sm font-semibold ${badge.className}`}
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

          <div className="ticket-details border-t border-dashed border-border grid grid-cols-2 gap-4 p-6 text-sm">
            <Field label="Titular" value={ticket.nombre ?? "—"} />
            <Field label="Teléfono" value={ticket.telefono ?? "—"} />
            <Field label="Ciudad" value={ticket.ciudad ?? "—"} />
            <Field label={amountLabel} value={formatCOP(amountValue)} />
            <Field label="Fecha compra" value={formatDate(ticket.fecha_compra)} />
            <Field label="Medio de pago" value={ticket.medio_pago ?? "—"} />
            {raffle?.staged_payments && (
              <Field label="Total abonado" value={formatCOP(totalPaid)} />
            )}
          </div>

          {raffle?.staged_payments && (
            <div className="border-t border-dashed border-border p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Progreso de pagos
                  </p>
                  <p className="mt-1 font-display text-2xl text-brand">
                    {formatCOP(totalPaid)}{" "}
                    <span className="text-sm text-muted-foreground">
                      de {formatCOP(ticketValue)}
                    </span>
                  </p>
                </div>
                <p className="text-sm font-semibold">{Math.round(paymentProgress)}%</p>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gold-gradient"
                  style={{ width: `${paymentProgress}%` }}
                />
              </div>
              <div className="mt-5 space-y-2">
                {stages.map((stage) => {
                  const paidAtCutoff = payments
                    .filter((payment) => new Date(payment.paid_at) <= new Date(stage.draw_at))
                    .reduce((sum, payment) => sum + payment.amount, 0);
                  const eligible = paidAtCutoff >= stage.minimum_paid;
                  return (
                    <div
                      key={stage.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/35 p-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold">{stage.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(stage.draw_at)} · Premio {formatCOP(stage.prize_amount)}
                        </p>
                      </div>
                      <span
                        className={eligible ? "text-brand font-semibold" : "text-muted-foreground"}
                      >
                        {eligible
                          ? "✓ Habilitado"
                          : `Faltan ${formatCOP(stage.minimum_paid - totalPaid)}`}
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/35 p-3 text-sm">
                  <div>
                    <p className="font-semibold">Sorteo mayor</p>
                    <p className="text-xs text-muted-foreground">Número principal {ticketNumber}</p>
                  </div>
                  <span
                    className={
                      totalPaid >= ticketValue
                        ? "text-brand font-semibold"
                        : "text-muted-foreground"
                    }
                  >
                    {totalPaid >= ticketValue
                      ? "✓ Habilitado"
                      : `Faltan ${formatCOP(ticketValue - totalPaid)}`}
                  </span>
                </div>
              </div>
              {payments.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-semibold text-brand">
                    Ver historial de abonos ({payments.length})
                  </summary>
                  <div className="mt-2 space-y-1 text-xs">
                    {payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex justify-between rounded-lg bg-secondary/40 p-2"
                      >
                        <span>{formatDate(payment.paid_at)}</span>
                        <strong>{formatCOP(payment.amount)}</strong>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          <div className="ticket-verification border-t border-dashed border-border p-4 text-center text-xs text-muted-foreground">
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
          {sharing ? "Generando imagen…" : "Enviar al WhatsApp del comprador"}
        </button>

        {ticket.estado === "reservado" && raffle?.whatsapp_admin && (
          <a
            href={buildWhatsAppUrl(
              raffle.whatsapp_admin,
              `Hola! Comprobante de pago para el número ${ticketNumber} — código ${ticket.codigo_verificacion}`,
            )}
            target="_blank"
            rel="noreferrer"
            className="ticket-action-secondary mt-3 print:hidden block text-center rounded-md py-3 font-semibold"
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
