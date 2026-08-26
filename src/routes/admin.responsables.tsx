/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminCreateResponsible,
  adminListResponsibles,
  adminSetResponsibleActive,
} from "@/lib/bono.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/responsables")({ component: ResponsiblesPage });
function ResponsiblesPage() {
  const list = useServerFn(adminListResponsibles),
    create = useServerFn(adminCreateResponsible),
    setActive = useServerFn(adminSetResponsibleActive),
    qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["bono-responsibles"], queryFn: () => list() });
  const [form, setForm] = useState({
    display_name: "",
    username: "",
    password: "",
    phone: "",
    public_page_enabled: false,
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create({ data: { ...form, phone: form.phone || null } });
      toast.success("Responsable creado. Entrega la contraseña inicial una sola vez.");
      setForm({
        display_name: "",
        username: "",
        password: "",
        phone: "",
        public_page_enabled: false,
      });
      qc.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-5">
        <h1 className="font-display text-xl text-gold">Crear responsable</h1>
        <p className="text-xs text-muted-foreground">
          El comprador no se registra. Estas credenciales son para quien administra los bonos
          asignados.
        </p>
        <Field label="Nombre">
          <Input
            required
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          />
        </Field>
        <Field label="Usuario">
          <Input
            required
            autoCapitalize="none"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
          />
        </Field>
        <Field label="Contraseña inicial">
          <Input
            required
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Field label="Teléfono">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.public_page_enabled}
            onChange={(e) => setForm({ ...form, public_page_enabled: e.target.checked })}
          />
          Página pública habilitada
        </label>
        <Button className="w-full">Crear y asignar usuario</Button>
      </form>
      <section>
        <h2 className="mb-3 font-display text-xl">Responsables</h2>
        <div className="space-y-2">
          {(data?.responsibles ?? []).map((r: any) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border bg-card p-4"
            >
              <div>
                <strong>{r.display_name}</strong>
                <p className="text-sm text-muted-foreground">
                  @{r.username} · {r.phone || "Sin teléfono"}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  await setActive({ data: { responsibleId: r.id, active: !r.active } });
                  qc.invalidateQueries();
                }}
              >
                {r.active ? "Desactivar" : "Reactivar"}
              </Button>
            </div>
          ))}
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
