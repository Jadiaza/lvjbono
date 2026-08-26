/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminCreateResponsible,
  adminDeleteResponsible,
  adminListResponsibles,
  adminResetResponsiblePassword,
  adminSetResponsibleActive,
  adminUpdateResponsible,
} from "@/lib/bono.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/responsables")({ component: ResponsiblesPage });
const emptyForm = {
  display_name: "",
  username: "",
  password: "",
  phone: "",
  public_page_enabled: false,
};

function ResponsiblesPage() {
  const list = useServerFn(adminListResponsibles),
    create = useServerFn(adminCreateResponsible),
    update = useServerFn(adminUpdateResponsible),
    remove = useServerFn(adminDeleteResponsible),
    resetPassword = useServerFn(adminResetResponsiblePassword),
    setActive = useServerFn(adminSetResponsibleActive),
    qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["bono-responsibles"], queryFn: () => list() });
  const [form, setForm] = useState(emptyForm),
    [editing, setEditing] = useState<any | null>(null),
    [newPassword, setNewPassword] = useState("");
  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["bono-responsibles"] });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create({ data: { ...form, phone: form.phone || null } });
      toast.success("Responsable creado. Entrega la contraseña inicial una sola vez.");
      setForm(emptyForm);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-5">
        <h1 className="font-display text-xl text-gold">Crear responsable</h1>
        <p className="text-xs text-muted-foreground">
          Estas credenciales son para quien administra los bonos asignados.
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
          />{" "}
          Página pública habilitada
        </label>
        <Button className="w-full">Crear responsable</Button>
      </form>
      <section>
        <h2 className="mb-3 font-display text-xl">Responsables</h2>
        <div className="space-y-2">
          {(data?.responsibles ?? []).map((r: any) => (
            <div key={r.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <strong>{r.display_name}</strong>
                  <p className="text-sm text-muted-foreground">
                    @{r.username} · {r.phone || "Sin teléfono"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.active ? "Activo" : "Inactivo"} · Página pública{" "}
                    {r.public_page_enabled ? "habilitada" : "deshabilitada"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing({ ...r });
                      setNewPassword("");
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await setActive({ data: { responsibleId: r.id, active: !r.active } });
                        toast.success(
                          r.active ? "Responsable desactivado." : "Responsable activado.",
                        );
                        await refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "No fue posible cambiar el estado.",
                        );
                      }
                    }}
                  >
                    {r.active ? "Desactivar" : "Activar"}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      if (!window.confirm(`¿Eliminar definitivamente a ${r.display_name}?`)) return;
                      try {
                        await remove({ data: { responsibleId: r.id } });
                        toast.success("Responsable eliminado.");
                        await refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "No fue posible eliminarlo.",
                        );
                      }
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
              {editing?.id === r.id && (
                <form
                  className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    try {
                      await update({
                        data: {
                          responsibleId: r.id,
                          display_name: editing.display_name,
                          phone: editing.phone || null,
                          public_page_enabled: editing.public_page_enabled,
                        },
                      });
                      if (newPassword)
                        await resetPassword({
                          data: { responsibleId: r.id, password: newPassword },
                        });
                      toast.success("Datos actualizados.");
                      setEditing(null);
                      setNewPassword("");
                      await refresh();
                    } catch (error) {
                      toast.error(
                        error instanceof Error ? error.message : "No fue posible actualizarlo.",
                      );
                    }
                  }}
                >
                  <Field label="Nombre">
                    <Input
                      required
                      value={editing.display_name}
                      onChange={(e) => setEditing({ ...editing, display_name: e.target.value })}
                    />
                  </Field>
                  <Field label="Teléfono">
                    <Input
                      value={editing.phone ?? ""}
                      onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                    />
                  </Field>
                  <Field label="Nueva contraseña (opcional)">
                    <Input
                      type="password"
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editing.public_page_enabled}
                      onChange={(e) =>
                        setEditing({ ...editing, public_page_enabled: e.target.checked })
                      }
                    />{" "}
                    Página pública habilitada
                  </label>
                  <div className="flex gap-2 md:col-span-2">
                    <Button>Guardar cambios</Button>
                    <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              )}
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
