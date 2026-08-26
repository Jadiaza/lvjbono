import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarClock, KeyRound, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  adminCreateRental,
  adminDeleteRentalUser,
  adminGetRentalCenter,
  adminRenewRental,
  adminResetRentalPassword,
  adminSetRentalActive,
  adminSetRentalPublicPage,
} from "@/lib/raffle.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCOP } from "@/lib/format";

type RentalItem = {
  id: string;
  user_id: string;
  responsable: string;
  prepaid_amount: number;
  starts_at: string;
  ends_at: string;
  active: boolean;
  currentlyActive: boolean;
  raffle: { nombre: string; slug: string | null } | null;
  account: { email: string | null; lastSignInAt: string | null } | null;
};

type RentalRaffle = { id: string; nombre: string };

export const Route = createFileRoute("/admin/alquileres")({ component: RentalCenter });

function RentalCenter() {
  const qc = useQueryClient();
  const getCenter = useServerFn(adminGetRentalCenter);
  const createRental = useServerFn(adminCreateRental);
  const setActive = useServerFn(adminSetRentalActive);
  const renewRental = useServerFn(adminRenewRental);
  const setPublicPage = useServerFn(adminSetRentalPublicPage);
  const resetPassword = useServerFn(adminResetRentalPassword);
  const deleteUser = useServerFn(adminDeleteRentalUser);
  const [open, setOpen] = useState(false);
  const [rentalToActivate, setRentalToActivate] = useState<RentalItem | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["rental-center"],
    queryFn: () => getCenter(),
  });

  async function submit(formData: FormData) {
    try {
      const result = await createRental({
        data: {
          raffleId: String(formData.get("raffleId")),
          email: String(formData.get("email")),
          password: String(formData.get("password")),
          responsable: String(formData.get("responsable")),
          slug: String(formData.get("slug")),
          startsAt: String(formData.get("startsAt")),
          endsAt: String(formData.get("endsAt")),
          prepaidAmount: Number(formData.get("prepaidAmount")),
          notes: String(formData.get("notes") ?? ""),
        },
      });
      toast.success(
        result.linkedExisting
          ? "Usuario existente asignado a la rifa."
          : "Usuario y alquiler creados.",
      );
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["rental-center"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible crear el alquiler.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <CalendarClock className="h-6 w-6 text-brand" /> Alquileres
          </h2>
          <p className="text-sm text-muted-foreground">
            Una cuenta independiente por talonario. Cada encargado administra únicamente las ventas
            y cobros del grupo asignado.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Crear alquiler
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : (
        <div className="grid gap-3">
          {(data?.rentals ?? []).map((rental: RentalItem) => (
            <article key={rental.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    <UserRound className="h-4 w-4 text-brand" />
                    {rental.responsable}
                  </p>
                  <p className="text-sm">{rental.raffle?.nombre ?? "Rifa no disponible"}</p>
                  <p className="text-xs text-muted-foreground">
                    {rental.account?.email ?? "Correo no disponible"}
                  </p>
                  {rental.raffle?.slug && (
                    <a
                      href={`/${rental.raffle.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block text-xs font-semibold text-brand underline"
                    >
                      {`/${rental.raffle.slug}`}
                    </a>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(rental.starts_at).toLocaleDateString("es-CO")} —{" "}
                    {new Date(rental.ends_at).toLocaleDateString("es-CO")} · Pagado por anticipado:{" "}
                    {formatCOP(rental.prepaid_amount)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      rental.currentlyActive
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {rental.currentlyActive
                      ? "Acceso vigente"
                      : rental.active
                        ? "Fuera de vigencia"
                        : "Suspendido"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (!rental.currentlyActive) {
                        setRentalToActivate(rental);
                        return;
                      }
                      try {
                        await setActive({ data: { rentalId: rental.id, active: false } });
                        toast.success("Cuenta suspendida.");
                        qc.invalidateQueries({ queryKey: ["rental-center"] });
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "No fue posible suspenderla.",
                        );
                      }
                    }}
                  >
                    {rental.currentlyActive ? "Suspender" : "Activar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const slug = prompt(
                        "Extensión pública (ejemplo: lvj001):",
                        rental.raffle?.slug ?? "",
                      );
                      if (!slug) return;
                      try {
                        await setPublicPage({
                          data: { rentalId: rental.id, slug: slug.toLowerCase().trim() },
                        });
                        toast.success("Página pública habilitada.");
                        qc.invalidateQueries({ queryKey: ["rental-center"] });
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "No fue posible habilitarla.",
                        );
                      }
                    }}
                  >
                    Configurar enlace
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Restablecer contraseña"
                    onClick={async () => {
                      const password = prompt("Nueva contraseña temporal (mínimo 8 caracteres):");
                      if (!password) return;
                      try {
                        await resetPassword({ data: { userId: rental.user_id, password } });
                        toast.success("Contraseña restablecida.");
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "No fue posible restablecerla.",
                        );
                      }
                    }}
                  >
                    <KeyRound className="h-4 w-4" />
                    <span className="sr-only">Restablecer contraseña</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    title="Eliminar usuario"
                    onClick={async () => {
                      if (
                        !confirm(
                          `¿Eliminar el acceso de ${rental.responsable}? Esta acción es permanente.`,
                        )
                      )
                        return;
                      try {
                        await deleteUser({ data: { userId: rental.user_id } });
                        toast.success("Usuario y alquiler eliminados.");
                        qc.invalidateQueries({ queryKey: ["rental-center"] });
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "No fue posible eliminarlo.",
                        );
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Eliminar usuario</span>
                  </Button>
                </div>
              </div>
            </article>
          ))}
          {!data?.rentals?.length && (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              Todavía no hay alquileres registrados.
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Crear usuario y alquiler</DialogTitle>
            <DialogDescription>
              El acceso solo funcionará dentro de estas fechas y para la rifa seleccionada.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit(new FormData(event.currentTarget));
            }}
          >
            <Field label="Rifa">
              <select
                name="raffleId"
                required
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Selecciona…</option>
                {(data?.raffles ?? []).map((raffle: RentalRaffle) => (
                  <option key={raffle.id} value={raffle.id}>
                    {raffle.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Responsable">
              <Input name="responsable" required />
            </Field>
            <Field label="Extensión pública">
              <div className="flex items-center rounded-md border bg-background pl-3">
                <span className="text-xs text-muted-foreground">/</span>
                <Input
                  name="slug"
                  required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="lvj001"
                  className="border-0"
                />
              </div>
            </Field>
            <Field label="Correo de acceso">
              <Input name="email" type="email" required />
            </Field>
            <Field label="Contraseña (solo para usuario nuevo)">
              <Input name="password" type="password" minLength={8} />
            </Field>
            <Field label="Inicio">
              <Input name="startsAt" type="datetime-local" required />
            </Field>
            <Field label="Finalización">
              <Input name="endsAt" type="datetime-local" required />
            </Field>
            <Field label="Alquiler pagado (COP)">
              <Input name="prepaidAmount" type="number" min={0} required />
            </Field>
            <Field label="Notas">
              <Input name="notes" />
            </Field>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit">Crear acceso temporal</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rentalToActivate}
        onOpenChange={(isOpen) => !isOpen && setRentalToActivate(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Activar cuenta existente</DialogTitle>
            <DialogDescription>
              Renueva el acceso de {rentalToActivate?.responsable}. Se conservarán la cuenta, la
              contraseña y la rifa asignada.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!rentalToActivate) return;
              const formData = new FormData(event.currentTarget);
              try {
                await renewRental({
                  data: {
                    rentalId: rentalToActivate.id,
                    startsAt: String(formData.get("startsAt")),
                    endsAt: String(formData.get("endsAt")),
                    prepaidAmount: Number(formData.get("prepaidAmount")),
                  },
                });
                toast.success("Cuenta activada correctamente.");
                setRentalToActivate(null);
                qc.invalidateQueries({ queryKey: ["rental-center"] });
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "No fue posible activar la cuenta.",
                );
              }
            }}
          >
            <Field label="Inicio">
              <Input name="startsAt" type="datetime-local" required />
            </Field>
            <Field label="Finalización">
              <Input name="endsAt" type="datetime-local" required />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Alquiler pagado (COP)">
                <Input
                  name="prepaidAmount"
                  type="number"
                  min={0}
                  defaultValue={rentalToActivate?.prepaid_amount ?? 0}
                  required
                />
              </Field>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRentalToActivate(null)}>
                Cancelar
              </Button>
              <Button type="submit">Activar cuenta</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
