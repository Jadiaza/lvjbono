import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListTickets,
  adminGetSorteo,
  adminRegistrarSorteo,
  adminListStages,
  adminSaveStage,
  adminRegisterStageDraw,
  adminRegisterFinalStageDraw,
} from "@/lib/raffle.functions";
import { formatCOP, pad2 } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CalendarPlus, Trophy } from "lucide-react";
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
  const listStages = useServerFn(adminListStages);
  const saveStage = useServerFn(adminSaveStage);
  const registerStage = useServerFn(adminRegisterStageDraw);
  const registerFinalStage = useServerFn(adminRegisterFinalStageDraw);
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
  const { data: stagesData } = useQuery({
    queryKey: ["raffle-stages", raffle?.id],
    queryFn: () => listStages({ data: { raffleId: raffle!.id } }),
    enabled: !!raffle?.staged_payments,
  });

  const [f, setF] = useState({ mayor: "", seco1: "", seco2: "" });
  const [loading, setLoading] = useState(false);
  const [stageSaving, setStageSaving] = useState(false);
  const [stageForm, setStageForm] = useState({
    name: "Sorteo alterno 1",
    drawAt: "",
    minimumPaid: 10000,
    prizeAmount: 0,
  });
  const [stageResults, setStageResults] = useState<Record<string, string>>({});

  useEffect(() => {
    if (raffle?.staged_payments && raffle.installment_amount) {
      setStageForm((current) => ({ ...current, minimumPaid: raffle.installment_amount! }));
    }
  }, [raffle?.id, raffle?.staged_payments, raffle?.installment_amount]);

  async function createStage(e: React.FormEvent) {
    e.preventDefault();
    if (!raffle || !stageForm.drawAt) return;
    setStageSaving(true);
    try {
      await saveStage({
        data: {
          raffleId: raffle.id,
          name: stageForm.name,
          drawAt: new Date(stageForm.drawAt).toISOString(),
          minimumPaid: stageForm.minimumPaid,
          prizeAmount: stageForm.prizeAmount,
        },
      });
      toast.success("Etapa programada");
      setStageForm({
        name: `Sorteo alterno ${(stagesData?.stages.length ?? 0) + 2}`,
        drawAt: "",
        minimumPaid: stageForm.minimumPaid + (raffle.installment_amount ?? 0),
        prizeAmount: 0,
      });
      qc.invalidateQueries({ queryKey: ["raffle-stages", raffle.id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setStageSaving(false);
    }
  }

  async function completeStage(stageId: string) {
    const value = stageResults[stageId];
    if (!value) return;
    if (!confirm("¿Registrar este resultado alterno? La elegibilidad se calculará al cierre."))
      return;
    try {
      await registerStage({ data: { stageId, result: Number(value) } });
      toast.success("Sorteo alterno registrado");
      qc.invalidateQueries({ queryKey: ["raffle-stages", raffle?.id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!raffle) return;
    if (!confirm("¿Registrar sorteo? Esto marcará los ganadores.")) return;
    setLoading(true);
    try {
      if (raffle.staged_payments) {
        await registerFinalStage({
          data: { raffleId: raffle.id, result: Number(f.mayor) },
        });
      } else {
        await registrar({
          data: {
            raffleId: raffle.id,
            premioMayor: Number(f.mayor),
            seco1: Number(f.seco1),
            seco2: Number(f.seco2),
          },
        });
      }
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
      {raffle.staged_payments && (
        <div className="rounded-xl border border-brand/30 bg-card p-6">
          <h2 className="font-display text-2xl text-gold flex items-center gap-2">
            <CalendarPlus className="h-6 w-6" />
            Sorteos alternos por etapas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada etapa usa el número alterno y exige el pago acumulado definido antes del cierre.
          </p>
          <form onSubmit={createStage} className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <Label>Nombre de la etapa</Label>
              <Input
                value={stageForm.name}
                onChange={(event) => setStageForm({ ...stageForm, name: event.target.value })}
              />
            </div>
            <div>
              <Label>Fecha y hora de cierre</Label>
              <Input
                required
                type="datetime-local"
                value={stageForm.drawAt}
                onChange={(event) => setStageForm({ ...stageForm, drawAt: event.target.value })}
              />
            </div>
            <div>
              <Label>Pago acumulado mínimo</Label>
              <Input
                type="number"
                min={1}
                max={raffle.valor_boleta}
                value={stageForm.minimumPaid}
                onChange={(event) =>
                  setStageForm({ ...stageForm, minimumPaid: Number(event.target.value) })
                }
              />
            </div>
            <div>
              <Label>Premio de la etapa</Label>
              <Input
                type="number"
                min={0}
                value={stageForm.prizeAmount}
                onChange={(event) =>
                  setStageForm({ ...stageForm, prizeAmount: Number(event.target.value) })
                }
              />
            </div>
            <Button
              disabled={stageSaving}
              className="bg-gold-gradient text-primary-foreground md:col-span-2"
            >
              {stageSaving ? "Guardando…" : "Agregar etapa"}
            </Button>
          </form>
          <div className="mt-5 space-y-3">
            {(stagesData?.stages ?? []).map((stage) => (
              <div key={stage.id} className="rounded-xl border border-border bg-secondary/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{stage.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(stage.draw_at).toLocaleString("es-CO")} · Mínimo{" "}
                      {formatCOP(stage.minimum_paid)} · Premio {formatCOP(stage.prize_amount)}
                    </p>
                  </div>
                  {stage.completed_at ? (
                    <div className="text-right">
                      <p className="font-display text-2xl text-brand">
                        {String(stage.result_number ?? 0).padStart(3, "0")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stage.winner_ticket_id ? "Ganador habilitado" : "Sin ganador habilitado"}
                      </p>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        className="w-28"
                        type="number"
                        min={0}
                        placeholder="Resultado"
                        value={stageResults[stage.id] ?? ""}
                        onChange={(event) =>
                          setStageResults({ ...stageResults, [stage.id]: event.target.value })
                        }
                      />
                      <Button type="button" onClick={() => completeStage(stage.id)}>
                        Registrar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-2xl text-gold flex items-center gap-2">
          <Trophy className="h-6 w-6" />
          Registrar sorteo
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {raffle.staged_payments
            ? "Ingresa el resultado del premio final. Participa el número principal elegido por el usuario y debe tener la boleta totalmente pagada."
            : "Ingresa los premios oficiales de la lotería. El sistema toma las cifras correspondientes y calcula las aproximaciones."}
        </p>
        <form onSubmit={submit} className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>{raffle.staged_payments ? "Resultado del premio final" : "Premio Mayor"}</Label>
            <Input
              required
              type="number"
              min="0"
              value={f.mayor}
              onChange={(e) => setF({ ...f, mayor: e.target.value })}
              placeholder="Ej: 1234"
            />
          </div>
          {!raffle.staged_payments && (
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
          )}
          {!raffle.staged_payments && (
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
          )}
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
