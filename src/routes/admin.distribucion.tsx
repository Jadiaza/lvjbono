/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminAssignResponsibleToBatch,
  adminGenerateBalancedBatches,
  adminListBonoBatches,
  adminListDualBonoCampaigns,
  adminListResponsibles,
} from "@/lib/bono.functions";
import { adminUnassignResponsibleFromBatch } from "@/lib/bono-unassign.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/distribucion")({ component: DistributionPage });
function DistributionPage() {
  const campaignsFn = useServerFn(adminListDualBonoCampaigns),
    responsiblesFn = useServerFn(adminListResponsibles),
    listBatches = useServerFn(adminListBonoBatches),
    generate = useServerFn(adminGenerateBalancedBatches),
    assign = useServerFn(adminAssignResponsibleToBatch),
    unassign = useServerFn(adminUnassignResponsibleFromBatch),
    qc = useQueryClient();
  const { data: campaigns } = useQuery({
    queryKey: ["dual-bono-campaigns"],
    queryFn: () => campaignsFn(),
  });
  const { data: responsibles } = useQuery({
    queryKey: ["bono-responsibles"],
    queryFn: () => responsiblesFn(),
  });
  const { data: batchData } = useQuery({
    queryKey: ["bono-batches"],
    queryFn: () => listBatches(),
  });
  const [form, setForm] = useState({ raffleId: "", lotCount: 10 });
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [releasing, setReleasing] = useState<string | null>(null);
  const activeResponsibles = (responsibles?.responsibles ?? []).filter((item: any) => item.active);

  async function generateLots(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await generate({ data: form });
      toast.success(
        `${result.total} bonos distribuidos en ${result.batches.length} lotes equilibrados (${result.minSize}–${result.maxSize} por lote).`,
      );
      await qc.invalidateQueries({ queryKey: ["bono-batches"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible generar los lotes.");
    }
  }

  async function assignResponsible(batchId: string) {
    const responsibleId = choices[batchId];
    if (!responsibleId) return toast.error("Selecciona un responsable.");
    try {
      const result = await assign({ data: { batchId, responsibleId } });
      toast.success(`${result.assigned} bonos asignados al responsable.`);
      setChoices((current) => ({ ...current, [batchId]: "" }));
      await qc.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible asignar el lote.");
    }
  }

  async function unassignResponsible(batch: any) {
    const name = batch.raffle_responsibles?.display_name ?? "el responsable actual";
    const confirmed = window.confirm(
      `¿Liberar ${batch.name || batch.code} de ${name}?\n\nLos bonos volverán a quedar disponibles y el lote podrá asignarse a otra persona. Esta opción solo funciona si el lote no tiene reservas, ventas ni pagos.`,
    );
    if (!confirmed) return;
    setReleasing(batch.id);
    try {
      const result = await unassign({ data: { batchId: batch.id } });
      toast.success(`${result.unassigned} bonos liberados. El lote ya puede asignarse nuevamente.`);
      await qc.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible liberar el lote.");
    } finally {
      setReleasing(null);
    }
  }

  return (
    <div className="space-y-7">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-2xl text-gold">Distribución equilibrada</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Primero genera lotes aleatorios y equilibrados. Después asigna un responsable diferente a
          cada lote.
        </p>
        <form onSubmit={generateLots} className="space-y-4 rounded-xl border bg-card p-6">
          <Field label="Campaña">
            <select
              required
              className="h-10 w-full rounded-md border bg-background px-3"
              value={form.raffleId}
              onChange={(e) => setForm({ ...form, raffleId: e.target.value })}
            >
              <option value="">Seleccionar…</option>
              {(campaigns?.campaigns ?? []).map((item: any) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cantidad de lotes">
            <Input
              type="number"
              min={1}
              max={500}
              value={form.lotCount}
              onChange={(e) => setForm({ ...form, lotCount: Number(e.target.value) })}
            />
          </Field>
          <Button className="w-full">Generar lotes equilibrados</Button>
        </form>
      </div>
      <section>
        <h2 className="mb-3 font-display text-xl">Lotes y responsables</h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="p-3 text-left">Lote</th>
                <th className="p-3 text-left">Campaña</th>
                <th>Bonos</th>
                <th className="p-3 text-left">Responsable / acceso</th>
                <th>Vendidos</th>
                <th>Pagados</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {(batchData?.batches ?? []).map((batch: any) => (
                <tr key={batch.id} className="border-t align-top">
                  <td className="p-3">
                    <strong>{batch.code}</strong>
                    <div className="text-xs text-muted-foreground">{batch.name}</div>
                  </td>
                  <td className="p-3">{batch.raffles?.nombre ?? "—"}</td>
                  <td className="text-center font-semibold">{batch.counts.total ?? 0}</td>
                  <td className="min-w-64 p-3">
                    {batch.raffle_responsibles ? (
                      <div className="space-y-2">
                        <div>
                          <strong>{batch.raffle_responsibles.display_name}</strong>
                          <div className="text-xs text-muted-foreground">
                            @{batch.raffle_responsibles.username}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs">
                          <a
                            className="text-gold underline"
                            href="/responsable-login"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Panel privado
                          </a>
                          <a
                            className="text-gold underline"
                            href={`/vendedor/${batch.raffle_responsibles.slug}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Página pública
                          </a>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-destructive/40 text-destructive hover:bg-destructive/10"
                          disabled={releasing === batch.id}
                          onClick={() => unassignResponsible(batch)}
                        >
                          {releasing === batch.id ? "Liberando…" : "Desasignar / liberar lote"}
                        </Button>
                        {(batch.counts.reservado || batch.counts.vendido || batch.counts.pagado) ? (
                          <p className="text-xs text-muted-foreground">
                            Para liberar el lote primero debe quedar sin reservas, ventas ni pagos.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <select
                          className="h-9 min-w-44 rounded-md border bg-background px-2"
                          value={choices[batch.id] ?? ""}
                          onChange={(e) => setChoices({ ...choices, [batch.id]: e.target.value })}
                        >
                          <option value="">Asignar responsable…</option>
                          {activeResponsibles.map((item: any) => (
                            <option key={item.id} value={item.id}>
                              {item.display_name}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" onClick={() => assignResponsible(batch.id)}>
                          Asignar
                        </Button>
                      </div>
                    )}
                  </td>
                  <td className="text-center">{batch.counts.vendido ?? 0}</td>
                  <td className="text-center">{batch.counts.pagado ?? 0}</td>
                  <td className="text-center capitalize">
                    {batch.raffle_responsibles ? batch.status : "libre"}
                  </td>
                </tr>
              ))}
              {!batchData?.batches?.length && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Aún no hay lotes. Genera la distribución inicial.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      {children}
    </div>
  );
}
