import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Gift, Trophy } from "lucide-react";
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

export const Route = createFileRoute("/resultados")({
  head: () => ({ meta: [{ title: "Resultados de sorteos anteriores" }] }),
  component: ResultsPage,
});

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
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-3 px-4 py-2">
          <Link to="/" className="inline-flex items-center gap-2 font-semibold text-ink">
            <ArrowLeft className="h-4 w-4" /> Volver al talonario
          </Link>
          <span className="inline-flex items-center gap-2 text-brand">
            <Trophy className="h-5 w-5" /> Resultados
          </span>
        </div>
      </header>
      <section className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-extrabold text-ink">Resultados de sorteos anteriores</h1>
        <p className="mt-2 text-muted-foreground">
          Información pública de los sorteos ya realizados.
        </p>
        {isLoading && <p className="mt-10 text-muted-foreground">Cargando resultados…</p>}
        {isError && <p className="mt-10 text-destructive">No fue posible cargar los resultados.</p>}
        {!isLoading && !isError && data.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center">
            <Gift className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">Aún no hay resultados de sorteos</h2>
            <p className="text-sm text-muted-foreground">
              Vuelve más tarde para ver los números ganadores.
            </p>
          </div>
        )}
        <div className="mt-8 grid gap-5">
          {(data as PublicDraw[]).map((draw) => {
            const digits = draw.raffle?.digitos === 3 ? 3 : 2;
            const winners = Array.isArray(draw.ganadores) ? (draw.ganadores as PublicWinner[]) : [];
            return (
              <article
                key={draw.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-ink">
                      {draw.raffle?.nombre ?? "Rifa"}
                      {draw.raffle?.serie ? ` · ${draw.raffle.serie}` : ""}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {draw.raffle?.loteria ?? "Sorteo"} ·{" "}
                      {new Date(draw.created_at).toLocaleDateString("es-CO")}
                    </p>
                  </div>
                  <div className="rounded-xl bg-brand-soft px-4 py-2 text-center text-brand">
                    <span className="block text-xs font-semibold uppercase">Premio mayor</span>
                    <strong className="text-3xl">{padNumber(draw.premio_mayor_num, digits)}</strong>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {winners.map((winner, index) => (
                    <div
                      key={`${winner.premio}-${index}`}
                      className="rounded-xl bg-secondary/60 p-3"
                    >
                      <p className="text-xs uppercase text-muted-foreground">
                        {winner.premio ?? "Premio"}
                      </p>
                      <p className="text-xl font-bold text-brand">
                        {padNumber(Number(winner.numero ?? 0), digits)}
                        {Number(winner.monto) > 0 && (
                          <span className="ml-2 text-sm text-foreground">
                            {formatCOP(Number(winner.monto))}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {winner.vendido ? "Boleta ganadora vendida" : "Número no vendido"}
                      </p>
                    </div>
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
