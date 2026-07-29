import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CircleCheck, Dices, Gift, TicketX, Trophy } from "lucide-react";
import { getPublicDrawResults } from "@/lib/raffle.functions";
import { formatCOP, formatDate, padNumber } from "@/lib/format";
import { getPublicSkinDefinition } from "@/lib/public-skins";

type PublicWinner = { premio?: string; numero?: number; monto?: number; vendido?: boolean };
type SkinColors = [string, string, string, string];
type PublicDraw = {
  id: string;
  premio_mayor_num: number;
  ganadores: unknown;
  created_at: string;
  draw_date: string;
  draw_number: string;
  raffle: {
    nombre: string;
    serie: string | null;
    digitos: number;
    loteria: string | null;
    public_skin: string | null;
  } | null;
};

const prizeOrder = [
  "Premio Mayor",
  "Seco 1",
  "Seco 2",
  "Aproximaci\u00f3n Anterior",
  "Aproximaci\u00f3n Posterior",
];

export const Route = createFileRoute("/resultados")({
  head: () => ({ meta: [{ title: "Resultados de sorteos" }] }),
  component: ResultsPage,
});

function WinnerBall({
  winner,
  digits,
  featured,
  colors,
}: {
  winner: PublicWinner;
  digits: 2 | 3;
  featured: boolean;
  colors: SkinColors;
}) {
  const number = padNumber(Number(winner.numero ?? 0), digits);
  const ballBackground = featured
    ? `radial-gradient(circle at 32% 25%, ${colors[3]} 0 8%, ${colors[2]} 30%, ${colors[1]} 68%, ${colors[0]} 100%)`
    : `radial-gradient(circle at 32% 25%, white 0 5%, ${colors[2]} 24%, ${colors[1]} 61%, color-mix(in srgb, ${colors[0]} 76%, black) 100%)`;
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <p className="mb-3 min-h-9 text-xs font-extrabold uppercase leading-tight tracking-wide text-white/90 sm:text-sm">
        {winner.premio ?? "Premio"}
      </p>
      <div
        className="relative grid aspect-square w-full max-w-32 place-items-center rounded-full border-4 border-white/60 shadow-[inset_-12px_-16px_22px_rgba(0,0,0,.24),inset_8px_8px_16px_rgba(255,255,255,.38),0_14px_24px_rgba(0,0,0,.28)] sm:max-w-36"
        style={{ background: ballBackground }}
      >
        <span className="absolute left-[23%] top-[14%] h-[17%] w-[28%] rotate-[-28deg] rounded-full bg-white/35 blur-[2px]" />
        <strong className="relative z-10 font-display text-4xl tracking-tight text-white drop-shadow-[0_2px_2px_rgba(0,0,0,.55)] sm:text-5xl">
          {number}
        </strong>
      </div>
      <p className="mt-3 text-sm font-bold text-white sm:text-base">
        {Number(winner.monto) > 0 ? formatCOP(Number(winner.monto)) : "Premio especial"}
      </p>
      <span
        className={`mt-1 inline-flex items-center gap-1 text-[11px] font-medium ${winner.vendido ? "text-emerald-200" : "text-white/65"}`}
      >
        {winner.vendido ? (
          <CircleCheck className="h-3.5 w-3.5" />
        ) : (
          <TicketX className="h-3.5 w-3.5" />
        )}
        {winner.vendido ? "Boleta vendida" : "N\u00famero no vendido"}
      </span>
    </div>
  );
}

function ResultsPage() {
  const getResults = useServerFn(getPublicDrawResults);
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["public-draw-results"],
    queryFn: () => getResults(),
  });

  const draws = data as PublicDraw[];
  const latestDraw = draws[0];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link to="/" className="inline-flex items-center gap-2 font-semibold text-ink">
            <ArrowLeft className="h-4 w-4" /> Volver al talonario
          </Link>
          <span className="inline-flex items-center gap-2 font-semibold text-brand">
            <Dices className="h-5 w-5" /> Resultados
          </span>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-brand">
            <Trophy className="h-4 w-4" /> Balotas ganadoras
          </span>
          <h1 className="mt-4 text-3xl font-extrabold text-ink sm:text-4xl">
            {latestDraw ? `Resultado sorteo ${latestDraw.draw_number}` : "Resultados de sorteos"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Consulta el último número ganador y el histórico de sorteos anteriores.
          </p>
        </div>

        {isLoading && (
          <p className="mt-10 text-center text-muted-foreground">Cargando resultados...</p>
        )}
        {isError && (
          <p className="mt-10 text-center text-destructive">
            No fue posible cargar los resultados.
          </p>
        )}
        {!isLoading && !isError && data.length === 0 && (
          <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-dashed border-border p-10 text-center">
            <Gift className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">A&uacute;n no hay resultados de sorteos</h2>
            <p className="text-sm text-muted-foreground">
              Vuelve m&aacute;s tarde para ver las balotas ganadoras.
            </p>
          </div>
        )}

        <div className="mt-8 grid gap-8">
          {draws.slice(0, 1).map((draw) => {
            const digits: 2 | 3 = draw.raffle?.digitos === 3 ? 3 : 2;
            const skin = getPublicSkinDefinition(draw.raffle?.public_skin);
            const colors = skin.colors;
            const rawWinners = Array.isArray(draw.ganadores)
              ? (draw.ganadores as PublicWinner[])
              : [];
            const winners = [...rawWinners].sort((a, b) => {
              const aIndex = prizeOrder.indexOf(a.premio ?? "");
              const bIndex = prizeOrder.indexOf(b.premio ?? "");
              return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex);
            });
            return (
              <article
                key={draw.id}
                data-public-skin={skin.id}
                className="overflow-hidden rounded-[2rem] border shadow-xl"
                style={{
                  borderColor: colors[2],
                  background: `linear-gradient(145deg, color-mix(in srgb, ${colors[0]} 72%, #080b14), color-mix(in srgb, ${colors[1]} 68%, #080b14) 55%, color-mix(in srgb, ${colors[0]} 78%, #080b14))`,
                }}
              >
                <div className="border-b border-white/15 bg-black/10 px-5 py-5 text-center text-white sm:px-8">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">
                    {formatDate(draw.draw_date)}
                  </p>
                  <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">
                    Resultado sorteo {draw.draw_number}
                  </h2>
                  <p className="mt-1 font-semibold text-white/90">
                    {draw.raffle?.nombre ?? "Rifa"}
                    {draw.raffle?.serie ? ` - ${draw.raffle.serie}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-white/75">
                    Resultado oficial - {draw.raffle?.loteria ?? "Sorteo"}
                  </p>
                  <span className="mt-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/80">
                    Skin: {skin.name}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 px-4 py-8 sm:px-8 lg:grid-cols-5 lg:gap-5 lg:py-10">
                  {winners.map((winner, index) => (
                    <WinnerBall
                      key={`${winner.premio}-${index}`}
                      winner={winner}
                      digits={digits}
                      featured={winner.premio === "Premio Mayor"}
                      colors={colors}
                    />
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        {draws.length > 1 && (
          <section className="mt-12">
            <div className="text-center">
              <h2 className="text-2xl font-extrabold text-ink sm:text-3xl">
                Resultados anteriores
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Histórico de los últimos sorteos registrados.
              </p>
            </div>
            <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="hidden grid-cols-[1fr_1fr_2fr] bg-ink px-5 py-3 text-xs font-bold uppercase tracking-wider text-white sm:grid">
                <span>Sorteo</span>
                <span>Fecha</span>
                <span>Resultado</span>
              </div>
              <div className="divide-y divide-border">
                {draws.slice(1).map((draw) => {
                  const digits: 2 | 3 = draw.raffle?.digitos === 3 ? 3 : 2;
                  const winners = Array.isArray(draw.ganadores)
                    ? (draw.ganadores as PublicWinner[])
                    : [];
                  return (
                    <article
                      key={draw.id}
                      className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_1fr_2fr] sm:items-center"
                    >
                      <div>
                        <span className="text-xs font-bold uppercase text-muted-foreground sm:hidden">
                          Sorteo:{" "}
                        </span>
                        <strong className="text-brand">{draw.draw_number}</strong>
                      </div>
                      <div className="text-sm">
                        <span className="font-bold uppercase text-muted-foreground sm:hidden">
                          Fecha:{" "}
                        </span>
                        {formatDate(draw.draw_date)}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {winners.map((winner, index) => (
                          <span
                            key={`${winner.premio}-${index}`}
                            className="inline-grid min-h-9 min-w-9 place-items-center rounded-full bg-brand px-2 text-sm font-extrabold text-white"
                            title={winner.premio}
                          >
                            {padNumber(Number(winner.numero ?? 0), digits)}
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
