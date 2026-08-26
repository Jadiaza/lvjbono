/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminAssignBonoBatch,
  adminListBonoBatches,
  adminListDualBonoCampaigns,
  adminListResponsibles,
} from "@/lib/bono.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/distribucion")({ component: DistributionPage });
function DistributionPage() {
  const campaignsFn = useServerFn(adminListDualBonoCampaigns),
    responsiblesFn = useServerFn(adminListResponsibles),
    assign = useServerFn(adminAssignBonoBatch),
    listBatches = useServerFn(adminListBonoBatches),
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
  const [form, setForm] = useState({
    raffleId: "",
    responsibleId: "",
    quantity: 25,
    name: "Lote 01",
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await assign({ data: form });
      toast.success(`${r.assigned} bonos asignados en ${r.batch.code}.`);
      await qc.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  }
  return (
    <div className="space-y-7">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-2xl text-gold">Distribución de bonos</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Asigna bonos ya generados a un responsable. Cada bono conserva sus dos números únicos.
        </p>
        <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-6">
          <Field label="Campaña">
            <select
              required
              className="h-10 w-full rounded-md border bg-background px-3"
              value={form.raffleId}
              onChange={(e) => setForm({ ...form, raffleId: e.target.value })}
            >
              <option value="">Seleccionar…</option>
              {(campaigns?.campaigns ?? []).map((x: any) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Responsable">
            <select
              required
              className="h-10 w-full rounded-md border bg-background px-3"
              value={form.responsibleId}
              onChange={(e) => setForm({ ...form, responsibleId: e.target.value })}
            >
              <option value="">Seleccionar…</option>
              {(responsibles?.responsibles ?? [])
                .filter((x: any) => x.active)
                .map((x: any) => (
                  <option key={x.id} value={x.id}>
                    {x.display_name} (@{x.username})
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Cantidad de bonos">
            <Input
              type="number"
              min={1}
              max={500}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
          </Field>
          <Field label="Nombre del lote">
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Button className="w-full">Asignar lote</Button>
        </form>
      </div>
      <section>
        <h2 className="mb-3 font-display text-xl">Lotes asignados</h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="p-3 text-left">Lote</th>
                <th className="p-3 text-left">Campaña</th>
                <th className="p-3 text-left">Responsable</th>
                <th>Bonos</th>
                <th>Vendidos</th>
                <th>Pagados</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(batchData?.batches ?? []).map((batch: any) => (
                <tr key={batch.id} className="border-t">
                  <td className="p-3">
                    <strong>{batch.code}</strong>
                    <div className="text-xs text-muted-foreground">{batch.name}</div>
                  </td>
                  <td className="p-3">{batch.raffles?.nombre ?? "—"}</td>
                  <td className="p-3">
                    {batch.raffle_responsibles?.display_name ?? "—"}
                    <div className="text-xs text-muted-foreground">
                      @{batch.raffle_responsibles?.username}
                    </div>
                  </td>
                  <td className="text-center">{batch.counts.total ?? 0}</td>
                  <td className="text-center">{batch.counts.vendido ?? 0}</td>
                  <td className="text-center">{batch.counts.pagado ?? 0}</td>
                  <td className="text-center capitalize">{batch.status}</td>
                  <td className="p-3">{new Date(batch.assigned_at).toLocaleDateString("es-CO")}</td>
                </tr>
              ))}
              {!batchData?.batches?.length && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Aún no hay lotes asignados.
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
