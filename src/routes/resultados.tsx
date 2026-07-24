import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CircleCheck, Dices, Gift, TicketX, Trophy } from "lucide-react";
import { getPublicDrawResults } from "@/lib/raffle.functions";
import { formatCOP, padNumber } from "@/lib/format";

type PublicWinner = {
  premio?: string;
  numero?: number;
  monto?: number;
  vendido?: boolean;
};

type PublicDraw = {
  id: string;
  premio_mayor_num: number;
  ganadores: unknown;
  created_at: string;
  raffle: {
    nombre: string;
    serie: string | null;
    digitos: number;
    loteria: string | null;
  } | null;
};

const prizeOrder = [
  "Premio Mayor",
  "Seco 1",
  "Seco 2",
  "Aproximaci�n Anterior",
  "Aproximaci�n Posterior",
];

export const Route = createFileRoute("/resultados")({
  head: () => ({ meta: [{ title: "Resultados de sorteos anteriores" }] }),
  component: ResultsPage,
});

function WinnerBall({
  winner,
  digits,
  featured,
}: {
  winner: PublicWinner;
  digits: 2 | 3;
  featured: boolean;
}) {
  const number = padNumber(Number(winner.numero ?? 0), digits);
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <p className="mb-3 min-h-9 text-xs font-extrabold uppercase leading-tight tracking-wide text-white/90 sm:text-sm">
        {winner.premio ?? "Premio"}
      </p>
      <div
        className={`relative grid aspect-square w-full max-w-32 place-items-center rounded-full border-4 shadow-[inset_-12px_-16px_22px_rgba(0,0,0,.24),inset_8px_8px_16px_rgba(255,255,255,.38),0_14px_24px_rgba(0,0,0,.28)] sm:max-w-36 ${
          featured ? "border-amber-100" : "border-white/55"
        }`}
        style={{
          background: featured
            ? "radial-gradient(circle at 32% 25%, #fff4a8 0 8%, #ffd02f 30%, #f39b08 68%, #b85b00 100%)"
            : "radial-gradient(circle at 32% 25%, #dff9ff 0 8%, #50c5ef 30%, #1268c4 68%, #06347b 100%)",
        }}
      >
        <span className="absolute left-[23%] top-[14%] h-[17%] w-[28%] rotate-[-28deg] rounded-full bg-white/35 blur-[2px]" />
        <strong
          className={`relative z-10 font-display text-4xl tracking-tight drop-shadow-sm sm:text-5xl ${featured ? "text-slate-950" : "text-white"}`}
        >
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
        {winner.vendido ? "Boleta vendida" : "N�mero no vendido"}
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
            Resultados de sorteos anteriores
          </h1>
          <p className="mt-2 text-muted-foreground">
            Consulta los cinco n�meros premiados de cada sorteo.
          </p>
        </div>

        {isLoading && (
          <p className="mt-10 text-center text-muted-foreground">Cargando resultados�</p>
        )}
        {isError && (
          <p className="mt-10 text-center text-destructive">
            No fue posible cargar los resultados.
          </p>
        )}
        {!isLoading && !isError && data.length === 0 && (
          <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-dashed border-border p-10 text-center">
            <Gift className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">A�n no hay resultados de sorteos</h2>
            <p className="text-sm text-muted-foreground">
              Vuelve m�s tarde para ver las balotas ganadoras.
            </p>
          </div>
        )}

        <div className="mt-8 grid gap-8">
          {(data as PublicDraw[]).map((draw) => {
            const digits = draw.raffle?.digitos === 3 ? 3 : 2;
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
                className="overflow-hidden rounded-[2rem] border border-brand/30 bg-[linear-gradient(145deg,#102a72,#154eb3_55%,#0a2d7b)] shadow-xl"
              >
                <div className="border-b border-white/15 bg-black/10 px-5 py-5 text-center text-white sm:px-8">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">
                    {new Date(draw.created_at).toLocaleDateString("es-CO", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">
                    {draw.raffle?.nombre ?? "Rifa"}
                    {draw.raffle?.serie ? ` � ${draw.raffle.serie}` : ""}
                  </h2>
                  <p className="mt-1 text-sm text-white/75">
                    Resultado oficial � {draw.raffle?.loteria ?? "Sorteo"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 px-4 py-8 sm:px-8 lg:grid-cols-5 lg:gap-5 lg:py-10">
                  {winners.map((winner, index) => (
                    <WinnerBall
                      key={`${winner.premio}-${index}`}
                      winner={winner}
                      digits={digits}
                      featured={winner.premio === "Premio Mayor"}
                    />
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
