/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminAssignBonoBatch,
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
    qc = useQueryClient();
  const { data: campaigns } = useQuery({
    queryKey: ["dual-bono-campaigns"],
    queryFn: () => campaignsFn(),
  });
  const { data: responsibles } = useQuery({
    queryKey: ["bono-responsibles"],
    queryFn: () => responsiblesFn(),
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
      qc.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  }
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-2xl text-gold">Distribución de bonos</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        El sistema toma consecutivos disponibles para facilitar el control físico.
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
        <Field label="Cantidad">
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
