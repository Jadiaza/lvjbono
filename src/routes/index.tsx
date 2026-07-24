import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import { toPng } from "html-to-image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowRight,
  Ticket,
  QrCode,
  Cloud,
  Dices,
  ShieldCheck,
  Trophy,
  Calendar,
  Sparkles,
  CheckCircle2,
  Menu,
  X,
} from "lucide-react";

import { getRaffleData, reservarNumero } from "@/lib/raffle.functions";
import { formatCOP, padNumber, formatDate } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Link } from "@tanstack/react-router";
import { getPublicSkinDefinition } from "@/lib/public-skins";
import { TurnstileWidget } from "@/components/turnstile-widget";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rifaya — Talonario digital 00 al 99" },
      {
        name: "description",
        content:
          "Rifa 100% virtual del 00 al 99. Boleta $10.000, premios por $500.000. Elige tu número, paga por Nequi / Daviplata / Bre-B y recibe tu ticket digital con QR.",
      },
      { property: "og:title", content: "Rifaya" },
      {
        property: "og:description",
        content: "Talonario digital · Tickets con QR · Sorteo transparente",
      },
    ],
  }),
  component: HomePage,
});

type TicketRow = {
  numero: number;
  estado: "disponible" | "reservado" | "vendido" | "ganador";
  premio_ganado: string | null;
};

function HomePage() {
  const qc = useQueryClient();
  const getData = useServerFn(getRaffleData);
  const reservar = useServerFn(reservarNumero);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["raffle-public"],
    queryFn: () => getData(),
    refetchInterval: 15000,
  });

  const [selected, setSelected] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sharingConfirmed, setSharingConfirmed] = useState(false);
  const confirmedTicketRef = useRef<HTMLDivElement>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [confirmed, setConfirmed] = useState<{
    codigo: string;
    numero: number;
    numeroAlterno: number | null;
  } | null>(null);

  const raffle = data?.raffle;
  const setupRequired = data?.setupRequired === true;
  const tickets: TicketRow[] = (data?.tickets ?? []) as TicketRow[];
  const stages = data?.stages ?? [];

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

  const stats = useMemo(() => {
    const disp = tickets.filter((t) => t.estado === "disponible").length;
    const res = tickets.filter((t) => t.estado === "reservado").length;
    const vend = tickets.filter((t) => t.estado === "vendido" || t.estado === "ganador").length;
    return { disp, res, vend };
  }, [tickets]);

  async function handleReservar(fd: FormData) {
    if (selected == null || !raffle) return;
    if (!turnstileToken) {
      toast.error("Confirma que no eres un robot.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        raffleId: raffle.id,
        numero: selected,
        nombre: String(fd.get("nombre") ?? ""),
        telefono: String(fd.get("telefono") ?? ""),
        ciudad: String(fd.get("ciudad") ?? ""),
        email: String(fd.get("email") ?? ""),
        medio_pago: String(fd.get("medio_pago") ?? "nequi") as
          | "nequi"
          | "daviplata"
          | "bre_b"
          | "transferencia",
        turnstileToken,
      };
      const res = await reservar({ data: payload });
      setConfirmed(res);
      setSelected(null);
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
      qc.invalidateQueries({ queryKey: ["raffle-public"] });
      toast.success(`¡Reservaste el número ${padNumber(res.numero, raffle.digitos as 2 | 3)}!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al reservar");
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  }

  async function shareConfirmedTicket() {
    if (!confirmed || !confirmedTicketRef.current) return;
    setSharingConfirmed(true);
    try {
      const dataUrl = await toPng(confirmedTicketRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: getComputedStyle(confirmedTicketRef.current).backgroundColor || "#ffffff",
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `boleta-${padded(confirmed.numero)}.png`, {
        type: "image/png",
      });
      const shareData = {
        files: [file],
        title: `Boleta ${padded(confirmed.numero)}`,
      };
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return;
      }
      const download = document.createElement("a");
      download.href = dataUrl;
      download.download = file.name;
      download.click();
      toast.success("Imagen descargada. Adjúntala directamente en WhatsApp.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("[shareConfirmedTicket] Could not generate image", error);
      toast.error("No fue posible generar la imagen de la boleta.");
    } finally {
      setSharingConfirmed(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="min-h-screen flex flex-col gap-4 items-center justify-center px-4 text-center">
        <p className="text-destructive">No fue posible cargar la rifa.</p>
        <Button type="button" variant="outline" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }
  if (!raffle) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-3xl font-bold text-ink">Sin rifa activa</h1>
          <p className="mt-2 text-muted-foreground">
            Aún no hay una rifa disponible. Vuelve pronto.
          </p>
          <Link to="/auth" className="mt-4 inline-block text-sm text-brand underline">
            Acceso administrador
          </Link>
        </div>
      </div>
    );
  }

  const digits = raffle.digitos as 2 | 3;
  const maxNumber = 10 ** digits - 1;
  const padded = (number: number) => padNumber(number, digits);

  const totalPremios =
    raffle.premio_mayor +
    raffle.premio_seco1 +
    raffle.premio_seco2 +
    raffle.premio_aprox_ant +
    raffle.premio_aprox_pos;
  const publicSkin = raffle.public_skin ?? "purpura-real";

  return (
    <div
      className="public-raffle min-h-screen bg-background text-foreground"
      data-public-skin={publicSkin}
    >
      {/* NAV */}
      <nav className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 min-h-16 py-2 flex flex-wrap items-center justify-between gap-2">
          <a href="#top" className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-white p-1 shadow-sm">
              <img
                src="/brand/rifaya-logo.png"
                alt="Rifaya"
                className="h-full w-full object-contain"
              />
            </div>
            <span className="font-bold text-lg tracking-tight text-ink">Rifaya</span>
          </a>
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <a href="#premios" className="hover:text-ink">
              Premios
            </a>
            <a href="#tablero" className="hover:text-ink">
              Talonario
            </a>
            <a href="#como" className="hover:text-ink">
              Cómo juega
            </a>
            <Link to="/resultados" className="inline-flex items-center gap-1.5 hover:text-ink">
              <Dices className="h-4 w-4" /> Resultados anteriores
            </Link>
          </div>
          <button
            type="button"
            className="md:hidden ml-auto grid h-10 w-10 place-items-center rounded-lg border border-border bg-white text-ink"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <a
            href="#tablero"
            className="hidden md:inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground text-sm font-semibold px-5 py-2.5 hover:opacity-90 transition"
          >
            Comprar boleta <ArrowRight className="h-4 w-4" />
          </a>
          {mobileMenuOpen && (
            <div className="md:hidden basis-full flex flex-col gap-1 border-t border-border pt-2 text-sm font-medium">
              <a
                href="#premios"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 hover:bg-secondary"
              >
                Premios
              </a>
              <a
                href="#tablero"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 hover:bg-secondary"
              >
                Talonario
              </a>
              <a
                href="#como"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 hover:bg-secondary"
              >
                Cómo juega
              </a>
              <Link
                to="/resultados"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 hover:bg-secondary"
              >
                <Dices className="h-4 w-4 text-brand" /> Resultados anteriores
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* HERO */}
      <header id="top" className="public-hero bg-hero-mesh">
        <div className="public-confetti" aria-hidden="true" />
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div className="public-hero-copy">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft text-brand text-xs font-semibold px-3 py-1.5 uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" /> Talonario digital
            </span>
            <h1 className="mt-4 text-4xl md:text-6xl font-extrabold tracking-tight text-ink leading-[1.05]">
              <span className="elegant-title">
                Compra tu boleta,
                <br />
                gana desde tu <span className="text-brand">celular</span>.
              </span>
              <span className="fiesta-title">
                RIFAYA
                <br />
                <span className="text-brand">RIFAS QUE CONECTAN</span>
              </span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-lg">
              Solución rápida y transparente para participar en{" "}
              <span className="font-semibold text-ink">{raffle.nombre}</span>. Elige tu número del
              {padded(0)} al {padded(maxNumber)}, paga en línea y recibe tu ticket digital con QR.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="#tablero"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand text-brand-foreground font-semibold px-6 py-3 hover:opacity-90 transition soft-shadow sm:w-auto"
              >
                Elegir mi número <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#como"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white text-ink border border-border font-semibold px-6 py-3 hover:bg-secondary transition sm:w-auto"
              >
                Ver cómo juega
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-6 text-sm">
              <MiniStat label="Valor boleta" value={formatCOP(raffle.valor_boleta)} />
              <MiniStat label="Total premios" value={formatCOP(totalPremios)} />
              <MiniStat
                label="Sorteo"
                value={formatDate(raffle.fecha_sorteo)}
                icon={<Calendar className="h-3.5 w-3.5" />}
              />
            </div>
          </div>

          {/* Ticket ilustrativo */}
          <div className="relative">
            <div className="public-ticket mx-auto max-w-sm rounded-3xl bg-white ticket-shadow overflow-hidden">
              <div className="bg-gold-gradient p-6 text-primary-foreground">
                <p className="text-xs uppercase tracking-[0.3em] opacity-80">Boleta virtual</p>
                <p className="font-bold text-2xl mt-1">{raffle.nombre}</p>
                <p className="text-xs opacity-90 mt-1">
                  {raffle.loteria ?? "Lotería"} · {formatDate(raffle.fecha_sorteo)}
                </p>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 sm:gap-4 sm:p-6">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Tu número
                  </p>
                  <p className="text-6xl font-extrabold text-brand leading-none tracking-tighter sm:text-7xl">
                    ##
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Elígelo en el talonario abajo
                  </p>
                </div>
                <div className="grid h-20 w-20 place-items-center rounded-lg bg-brand-soft sm:h-24 sm:w-24">
                  <QrCode className="h-12 w-12 text-brand sm:h-14 sm:w-14" strokeWidth={1.5} />
                </div>
              </div>
              <div className="flex flex-col gap-1 border-t border-dashed border-border p-4 text-xs text-muted-foreground sm:flex-row sm:justify-between">
                <span>Nequi · Daviplata · Bre-B</span>
                <span className="text-brand font-semibold">{formatCOP(raffle.valor_boleta)}</span>
              </div>
            </div>
            <div className="absolute -top-3 -right-3 rotate-6 rounded-full bg-warning text-warning-foreground text-xs font-bold px-3 py-1.5 shadow-md">
              {tickets.length} números
            </div>
          </div>
        </div>
      </header>

      {/* FEATURES */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-16 sm:grid-cols-2 md:grid-cols-4">
        <Feature
          icon={<Ticket className="h-8 w-8" strokeWidth={2} />}
          title="Página web"
          text="Talonario online para que veas y elijas tu número desde cualquier dispositivo."
        />
        <Feature
          icon={<QrCode className="h-8 w-8" strokeWidth={2} />}
          title="Tickets con QR"
          text="Cada boleta tiene un código único que puedes verificar y compartir por WhatsApp."
        />
        <Feature
          icon={<Cloud className="h-8 w-8" strokeWidth={2} />}
          title="En la nube"
          text="Todo respaldado y accesible en cualquier momento desde tu teléfono."
        />
        <Feature
          icon={<Dices className="h-8 w-8" strokeWidth={2} />}
          title="Sorteo transparente"
          text="Los ganadores se calculan con el resultado oficial de la lotería."
        />
      </section>

      {/* PREMIOS */}
      <section id="premios" className="public-prizes bg-secondary/40 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-white border border-border text-brand text-xs font-semibold px-3 py-1.5 uppercase tracking-wider">
              <Trophy className="h-3.5 w-3.5" /> Premios
            </span>
            <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-ink tracking-tight">
              5 oportunidades de ganar
            </h2>
            <p className="mt-3 text-muted-foreground">
              Total en premios:{" "}
              <span className="text-brand font-bold">{formatCOP(totalPremios)}</span>
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-5">
            <PrizeCard rank="Mayor" label="Premio Mayor" amount={raffle.premio_mayor} highlight />
            <PrizeCard rank="1" label="Seco 1" amount={raffle.premio_seco1} />
            <PrizeCard rank="2" label="Seco 2" amount={raffle.premio_seco2} />
            <PrizeCard rank="↑" label="Aprox. Anterior" amount={raffle.premio_aprox_ant} />
            <PrizeCard rank="↓" label="Aprox. Posterior" amount={raffle.premio_aprox_pos} />
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-3 px-4 pt-16 text-center min-[380px]:grid-cols-3">
        <StatCard value={stats.disp} label="Disponibles" tone="brand" />
        <StatCard value={stats.res} label="Reservados" tone="warning" />
        <StatCard value={stats.vend} label="Vendidos" tone="destructive" />
      </section>

      {/* TABLERO */}
      <section id="tablero" className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center max-w-xl mx-auto mb-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft text-brand text-xs font-semibold px-3 py-1.5 uppercase tracking-wider">
            <Ticket className="h-3.5 w-3.5" /> Talonario
          </span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-ink tracking-tight">
            Elige tu número
          </h2>
          <p className="mt-2 text-muted-foreground">
            Toca cualquier número disponible para reservarlo.
          </p>
        </div>
        {raffle.staged_payments && (
          <div className="mx-auto mb-6 max-w-3xl rounded-3xl border border-brand/30 bg-brand-soft/55 p-5">
            <h3 className="font-display text-xl text-brand">Dos números, una sola boleta</h3>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <p>
                🎯 <strong>Eliges</strong> tu número principal para el sorteo mayor.
              </p>
              <p>
                🎁 Recibes un <strong>número alterno</strong> para los premios por etapas.
              </p>
              <p>
                💳 Puedes abonar desde <strong>{formatCOP(raffle.installment_amount)}</strong> y
                mantenerte al día.
              </p>
            </div>
            {stages.length > 0 && (
              <div className="mt-4 grid gap-2">
                {stages.map((stage) => (
                  <div
                    key={stage.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-xs"
                  >
                    <strong>{stage.name}</strong>
                    <span>
                      {formatDate(stage.draw_at)} · Requiere {formatCOP(stage.minimum_paid)} ·
                      Premio {formatCOP(stage.prize_amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="public-board rounded-3xl bg-white border border-border soft-shadow p-4 md:p-6 max-w-3xl mx-auto">
          {setupRequired && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-warning/50 bg-warning/15 px-4 py-3 text-sm text-warning-foreground"
            >
              El talonario está temporalmente en configuración. No se aceptan reservas hasta
              completar la actualización segura de la base de datos.
            </div>
          )}
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 md:gap-2">
            {tickets.map((t) => (
              <NumberCell
                key={t.numero}
                ticket={t}
                digits={digits}
                onClick={() => setSelected(t.numero)}
              />
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <Legend swatch="bg-white border-2 border-border" label="Disponible" />
            <Legend swatch="bg-warning" label="Reservado" />
            <Legend swatch="bg-muted-foreground/40" label="Vendido" />
            <Legend swatch="bg-brand" label="Ganador" />
          </div>
        </div>
      </section>

      {/* INSTRUCCIONES */}
      <section id="como" className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-6">
        <div className="rounded-3xl bg-white border border-border p-8 soft-shadow">
          <div className="h-11 w-11 rounded-xl bg-brand-soft text-brand grid place-items-center mb-4">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="text-2xl font-bold text-ink">Cómo se juega</h3>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            <Step n={1}>
              Se juega con el resultado oficial de{" "}
              <span className="font-semibold text-ink">
                {raffle.loteria ?? "una lotería colombiana"}
              </span>
              .
            </Step>
            <Step n={2}>
              <span className="font-semibold text-ink">Premio Mayor</span>: las dos últimas cifras
              del Premio Mayor.
            </Step>
            <Step n={3}>
              <span className="font-semibold text-ink">Seco 1 y 2</span>: dos últimas cifras de los
              secos oficiales.
            </Step>
            <Step n={4}>
              <span className="font-semibold text-ink">Aproximaciones</span>: número anterior y
              posterior al Mayor (con vuelta {padded(0)}↔{padded(maxNumber)}).
            </Step>
            <Step n={5}>
              Los premios <span className="font-semibold text-brand">no son acumulables</span>: se
              paga el de mayor valor.
            </Step>
          </ol>
        </div>
        <div className="rounded-3xl bg-white border border-border p-8 soft-shadow">
          <div className="h-11 w-11 rounded-xl bg-brand-soft text-brand grid place-items-center mb-4">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h3 className="text-2xl font-bold text-ink">Recomendaciones</h3>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <Bullet>Guarda el enlace de tu boleta virtual en un lugar seguro.</Bullet>
            <Bullet>Verifica el número y la fecha del sorteo al comprar.</Bullet>
            <Bullet>Recibes confirmación inmediata con código de verificación.</Bullet>
            <Bullet>Al participar aceptas todas las condiciones de esta rifa.</Bullet>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="public-cta rounded-3xl bg-gold-gradient p-10 md:p-14 text-center text-white soft-shadow">
          <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            ¿Listo para probar tu suerte?
          </h3>
          <p className="mt-3 opacity-90 max-w-md mx-auto">
            Elige tu número favorito antes de que se agoten los cupos.
          </p>
          <a
            href="#tablero"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white text-brand font-bold px-6 py-3 hover:opacity-90 transition"
          >
            Ir al talonario <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Rifaya · Talonario 100% virtual</p>
          <Link to="/auth" className="hover:text-brand">
            Acceso administrador
          </Link>
        </div>
      </footer>

      {/* Dialog reservar */}
      <Dialog
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setTurnstileToken(null);
            setTurnstileResetKey((value) => value + 1);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Reservar número{" "}
              <span className="text-brand">{selected != null ? padded(selected) : ""}</span>
            </DialogTitle>
            <DialogDescription>
              Completa tus datos. Te mostraremos los datos de pago y podrás enviar el comprobante
              por WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleReservar(new FormData(e.currentTarget));
            }}
            className="space-y-3"
          >
            <div>
              <Label htmlFor="nombre">Nombre completo *</Label>
              <Input id="nombre" name="nombre" required minLength={2} maxLength={80} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="telefono">Teléfono *</Label>
                <Input
                  id="telefono"
                  name="telefono"
                  required
                  minLength={7}
                  maxLength={20}
                  placeholder="300..."
                />
              </div>
              <div>
                <Label htmlFor="ciudad">Ciudad *</Label>
                <Input id="ciudad" name="ciudad" required minLength={2} maxLength={60} />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email (opcional)</Label>
              <Input id="email" name="email" type="email" maxLength={120} />
            </div>
            <div>
              <Label>Medio de pago</Label>
              <RadioGroup
                name="medio_pago"
                defaultValue="nequi"
                className="mt-1 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2"
              >
                {raffle.nequi && <PayOpt id="nequi" label="Nequi" />}
                {raffle.daviplata && <PayOpt id="daviplata" label="Daviplata" />}
                {raffle.bre_b && <PayOpt id="bre_b" label="Bre-B" />}
                <PayOpt id="transferencia" label="Transferencia" />
              </RadioGroup>
            </div>
            <TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileResetKey} />
            <Button
              type="submit"
              disabled={submitting || !turnstileToken}
              className="w-full rounded-full bg-brand text-brand-foreground font-semibold h-11 hover:opacity-90"
            >
              {submitting ? "Reservando…" : "Reservar mi número"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmación */}
      <Dialog open={!!confirmed} onOpenChange={(o) => !o && setConfirmed(null)}>
        <DialogContent className="max-w-md">
          <div
            ref={confirmedTicketRef}
            className="confirmation-ticket-image rounded-2xl bg-card p-4 text-card-foreground"
          >
            <DialogHeader>
              <div className="mx-auto mb-2 h-14 w-14 rounded-full bg-brand-soft grid place-items-center">
                <CheckCircle2 className="h-8 w-8 text-brand" />
              </div>
              <DialogTitle className="text-2xl font-bold text-center">
                ¡Reserva registrada!
              </DialogTitle>
              <DialogDescription className="text-center">
                Tu número{" "}
                <strong className="text-ink">{confirmed ? padded(confirmed.numero) : ""}</strong>{" "}
                quedó reservado. Realiza el pago y envía el comprobante para confirmarla.
              </DialogDescription>
              {confirmed?.numeroAlterno != null && (
                <div className="mx-auto mt-3 rounded-2xl border border-brand/30 bg-brand-soft/60 px-5 py-3 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Tu número alterno
                  </p>
                  <p className="font-display text-4xl text-brand">
                    {String(confirmed.numeroAlterno).padStart(3, "0")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Participará en los premios pequeños cuando estés al día.
                  </p>
                </div>
              )}
            </DialogHeader>
            <div className="space-y-2 text-sm">
              {raffle.nequi && <PayLine label="Nequi" value={raffle.nequi} />}
              {raffle.daviplata && <PayLine label="Daviplata" value={raffle.daviplata} />}
              {raffle.bre_b && <PayLine label="Bre-B" value={raffle.bre_b} />}
              <p className="text-xs text-center text-muted-foreground pt-1">
                Valor a pagar:{" "}
                <span className="text-brand font-bold">{formatCOP(raffle.valor_boleta)}</span>
              </p>
            </div>
            <p className="mt-3 border-t border-dashed border-border pt-3 text-center font-mono text-[10px] text-muted-foreground">
              Código: {confirmed?.codigo}
            </p>
          </div>
          {confirmed && (
            <button
              type="button"
              onClick={shareConfirmedTicket}
              disabled={sharingConfirmed}
              className="block w-full rounded-full bg-brand py-3 text-center font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60"
            >
              {sharingConfirmed ? "Generando imagen…" : "Compartir imagen de la boleta"}
            </button>
          )}
          {confirmed && (
            <Link
              to="/boleta/$codigo"
              params={{ codigo: confirmed.codigo }}
              className="block text-center rounded-full border border-border py-2.5 text-ink hover:bg-secondary text-sm font-medium"
            >
              Ver mi boleta virtual
            </Link>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="font-bold text-ink">{value}</p>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-soft text-brand grid place-items-center">
        {icon}
      </div>
      <h3 className="mt-4 font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function PrizeCard({
  rank,
  label,
  amount,
  highlight = false,
}: {
  rank: string;
  label: string;
  amount: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 text-center ${highlight ? "bg-gold-gradient text-primary-foreground border-transparent soft-shadow" : "bg-white border-border"}`}
    >
      <div
        className={`prize-rank mx-auto grid h-10 w-10 place-items-center rounded-full font-bold text-xs ${highlight ? "bg-white/20 text-primary-foreground" : "bg-brand-soft text-brand"}`}
      >
        {rank}
      </div>
      <p
        className={`mt-3 text-xs uppercase tracking-wider ${highlight ? "opacity-90" : "text-muted-foreground"}`}
      >
        {label}
      </p>
      <p className={`mt-1 text-2xl font-extrabold ${highlight ? "" : "text-ink"}`}>
        {formatCOP(amount)}
      </p>
    </div>
  );
}

function StatCard({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "brand" | "warning" | "destructive";
}) {
  const tones: Record<string, string> = {
    brand: "text-brand",
    warning: "text-brand",
    destructive: "text-brand",
  };
  return (
    <div className={`stat-card stat-card--${tone} rounded-2xl bg-white border border-border p-4`}>
      <p className={`text-3xl font-extrabold ${tones[tone]}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function NumberCell({
  ticket,
  digits,
  onClick,
}: {
  ticket: TicketRow;
  digits: 2 | 3;
  onClick: () => void;
}) {
  const base =
    "number-cell aspect-square flex items-center justify-center rounded-xl font-bold text-base md:text-lg transition-all";
  if (ticket.estado === "disponible") {
    return (
      <button
        onClick={onClick}
        className={`${base} number-cell--available bg-white border-2 border-border text-ink hover:border-brand hover:bg-brand hover:text-brand-foreground hover:scale-105 active:scale-95`}
      >
        {padNumber(ticket.numero, digits)}
      </button>
    );
  }
  return (
    <div
      className={`${base} number-cell--occupied number-cell--${ticket.estado} cursor-not-allowed`}
      title={ticket.estado}
    >
      <span>{padNumber(ticket.numero, digits)}</span>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3.5 w-3.5 rounded ${swatch}`} />
      {label}
    </span>
  );
}
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex-none h-6 w-6 rounded-full bg-brand-soft text-brand text-xs font-bold grid place-items-center">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <CheckCircle2 className="flex-none h-5 w-5 text-brand mt-0.5" />
      <span>{children}</span>
    </li>
  );
}
function PayOpt({ id, label }: { id: string; label: string }) {
  return (
    <label
      htmlFor={`pay-${id}`}
      className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
    >
      <RadioGroupItem value={id} id={`pay-${id}`} />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}
function PayLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center rounded-xl border border-border bg-secondary/50 px-4 py-2.5">
      <span className="text-muted-foreground text-xs uppercase tracking-wider">{label}</span>
      <span className="font-mono font-semibold text-ink">{value}</span>
    </div>
  );
}
