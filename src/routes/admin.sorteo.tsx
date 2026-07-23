import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListTickets, adminGetSorteo, adminRegistrarSorteo } from "@/lib/raffle.functions";
import { formatCOP, pad2 } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { useSelectedRaffle } from "@/hooks/use-selected-raffle";

export const Route = createFileRoute("/admin/sorteo")({
  component: AdminSorteo,
});

type Ganador = {
  premio: string;
  numero: number;
  monto: number;
  acumulado: boolean;
  nombre: string | null;
  telefono: string | null;
  ciudad: string | null;
  vendido: boolean;
};

function AdminSorteo() {
  const qc = useQueryClient();
  const list = useServerFn(adminListTickets);
  const getSorteo = useServerFn(adminGetSorteo);
  const registrar = useServerFn(adminRegistrarSorteo);
  const { id: selectedId } = useSelectedRaffle();

  const { data } = useQuery({
    queryKey: ["admin-tickets", selectedId],
    queryFn: () => list({ data: selectedId ? { raffleId: selectedId } : {} }),
  });
  const raffle = data?.raffle;
  const { data: sorteo } = useQuery({
    queryKey: ["sorteo", raffle?.id],
    queryFn: () => getSorteo({ data: { raffleId: raffle!.id } }),
    enabled: !!raffle,
  });

  const [f, setF] = useState({ mayor: "", seco1: "", seco2: "" });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!raffle) return;
    if (!confirm("¿Registrar sorteo? Esto marcará los ganadores.")) return;
    setLoading(true);
    try {
      await registrar({
        data: {
          raffleId: raffle.id,
          premioMayor: Number(f.mayor),
          seco1: Number(f.seco1),
          seco2: Number(f.seco2),
        },
      });
      toast.success("Sorteo registrado");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (!raffle) return <p className="text-muted-foreground">No hay rifa.</p>;
  const ganadores = ((sorteo as { ganadores: Ganador[] } | null)?.ganadores ?? []) as Ganador[];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-2xl text-gold flex items-center gap-2">
          <Trophy className="h-6 w-6" />
          Registrar sorteo
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ingresa los premios oficiales de la lotería. El sistema tomará automáticamente las dos
          últimas cifras y calculará aproximaciones.
        </p>
        <form onSubmit={submit} className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Premio Mayor</Label>
            <Input
              required
              type="number"
              min="0"
              value={f.mayor}
              onChange={(e) => setF({ ...f, mayor: e.target.value })}
              placeholder="Ej: 1234"
            />
          </div>
          <div>
            <Label>Seco 1</Label>
            <Input
              required
              type="number"
              min="0"
              value={f.seco1}
              onChange={(e) => setF({ ...f, seco1: e.target.value })}
            />
          </div>
          <div>
            <Label>Seco 2</Label>
            <Input
              required
              type="number"
              min="0"
              value={f.seco2}
              onChange={(e) => setF({ ...f, seco2: e.target.value })}
            />
          </div>
          <Button
            disabled={loading}
            className="md:col-span-3 bg-gold-gradient text-primary-foreground font-semibold"
          >
            {loading ? "Procesando…" : "Registrar y calcular ganadores"}
          </Button>
        </form>
      </div>

      {ganadores.length > 0 && (
        <div className="rounded-xl border border-gold/40 bg-card p-6">
          <h3 className="font-display text-xl text-gold">Resultados del sorteo</h3>
          <div className="mt-4 space-y-3">
            {ganadores.map((g, i) => (
              <div
                key={i}
                className={`rounded-lg border p-4 ${g.monto > 0 ? "border-gold/40 bg-gold/5" : "border-border bg-secondary/30 opacity-70"}`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">{g.premio}</p>
                    <p className="font-display text-3xl text-gold">
                      {pad2(g.numero)}{" "}
                      <span className="text-base text-foreground ml-2">{formatCOP(g.monto)}</span>
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    {g.acumulado ? (
                      <span className="text-warning">Sin acumular (mismo número)</span>
                    ) : g.vendido ? (
                      <div>
                        <p className="font-semibold">{g.nombre ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {g.telefono ?? "—"} · {g.ciudad ?? "—"}
                        </p>
                      </div>
                    ) : (
                      <span className="text-destructive">Número no vendido</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
