/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import {
  adminCreateResponsible,
  adminDeleteResponsible,
  adminListResponsibles,
  adminSetResponsibleActive,
  adminUpdateResponsible,
} from "@/lib/bono.functions";
import { adminResetResponsiblePasswordWithToken } from "@/lib/admin-responsible-password.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
    resetPassword = useServerFn(adminResetResponsiblePasswordWithToken),
    setActive = useServerFn(adminSetResponsibleActive),
    qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["bono-responsibles"], queryFn: () => list() });
  const [form, setForm] = useState(emptyForm),
    [editing, setEditing] = useState<any | null>(null),
    [resetTarget, setResetTarget] = useState<any | null>(null),
    [resetValue, setResetValue] = useState(""),
    [resetConfirm, setResetConfirm] = useState(""),
    [resetting, setResetting] = useState(false);
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
  async function submitPasswordReset(event: React.FormEvent) {
    event.preventDefault();
    if (!resetTarget) return;
    if (resetValue.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (resetValue !== resetConfirm) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    if (!window.confirm(`¿Resetear la contraseña de ${resetTarget.display_name}?`)) return;
    setResetting(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error("Tu sesión de administrador venció. Vuelve a iniciar sesión.");
      }
      await resetPassword({
        data: {
          responsibleId: resetTarget.id,
          password: resetValue,
          accessToken,
        },
      });
      toast.success(`Contraseña de ${resetTarget.display_name} restablecida correctamente.`);
      setResetTarget(null);
      setResetValue("");
      setResetConfirm("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible resetear la contraseña.");
    } finally {
      setResetting(false);
    }
  }
  return (
    <>
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
                    <Button variant="outline" onClick={() => setEditing({ ...r })}>
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setResetTarget(r);
                        setResetValue("");
                        setResetConfirm("");
                      }}
                    >
                      <KeyRound className="mr-1 h-4 w-4" /> Resetear contraseña
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          await setActive({ data: { responsibleId: r.id, active: !r.active } });
                          toast.success(r.active ? "Responsable desactivado." : "Responsable activado.");
                          await refresh();
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "No fue posible cambiar el estado.",
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
                        toast.success("Datos actualizados.");
                        setEditing(null);
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
                    <label className="flex items-center gap-2 text-sm md:col-span-2">
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

      <Dialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setResetTarget(null);
            setResetValue("");
            setResetConfirm("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resetear contraseña</DialogTitle>
          </DialogHeader>
          {resetTarget && (
            <>
              <div className="rounded-xl bg-secondary p-3 text-sm">
                <p><strong>Responsable:</strong> {resetTarget.display_name}</p>
                <p><strong>Usuario:</strong> @{resetTarget.username}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Usa esta opción únicamente cuando el responsable haya olvidado su contraseña. La nueva clave debe tener al menos 8 caracteres.
              </p>
              <form onSubmit={submitPasswordReset} className="space-y-3">
                <Field label="Nueva contraseña">
                  <Input
                    type="password"
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                    value={resetValue}
                    onChange={(e) => setResetValue(e.target.value)}
                  />
                </Field>
                <Field label="Confirmar nueva contraseña">
                  <Input
                    type="password"
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                    value={resetConfirm}
                    onChange={(e) => setResetConfirm(e.target.value)}
                  />
                </Field>
                <Button className="w-full" disabled={resetting}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  {resetting ? "Reseteando…" : "Confirmar nueva contraseña"}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
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
