import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HandHeart, MessageCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  adminCreateSponsor,
  adminCreateSponsorshipPlan,
  adminGetSponsorshipCenter,
  adminRegisterSponsorContribution,
} from "@/lib/raffle.functions";
import { buildWhatsAppUrl, formatCOP } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/padrinos")({ component: SponsorshipCenter });

function SponsorshipCenter() {
  const qc = useQueryClient();
  const getCenter = useServerFn(adminGetSponsorshipCenter);
  const createPlan = useServerFn(adminCreateSponsorshipPlan);
  const createSponsor = useServerFn(adminCreateSponsor);
  const registerContribution = useServerFn(adminRegisterSponsorContribution);
  const query = useQuery({ queryKey: ["sponsorship-center"], queryFn: () => getCenter() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["sponsorship-center"] });
  const plans = query.data?.plans ?? [];
  const sponsors = query.data?.sponsors ?? [];

  const planMutation = useMutation({
    mutationFn: (form: FormData) =>
      createPlan({
        data: {
          name: String(form.get("name")),
          description: String(form.get("description") ?? ""),
          monthlyAmount: Number(form.get("monthlyAmount")),
          dueDay: Number(form.get("dueDay")),
          startsOn: String(form.get("startsOn")),
          endsOn: String(form.get("endsOn") ?? "") || null,
        },
      }),
    onSuccess: () => {
      toast.success("Plan creado.");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const sponsorMutation = useMutation({
    mutationFn: (form: FormData) =>
      createSponsor({
        data: {
          planId: String(form.get("planId")),
          name: String(form.get("name")),
          phone: String(form.get("phone")),
          city: String(form.get("city") ?? ""),
          email: String(form.get("email") ?? ""),
          monthlyAmount: Number(form.get("monthlyAmount")),
          nextDueOn: String(form.get("nextDueOn")),
        },
      }),
    onSuccess: () => {
      toast.success("Padrino registrado.");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
          <HandHeart className="h-6 w-6 text-brand" /> Plan Padrino
        </h1>
        <p className="text-sm text-muted-foreground">
          Campañas permanentes de sostenimiento, aportes mensuales y seguimiento de padrinos.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Crear campaña</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                planMutation.mutate(new FormData(event.currentTarget));
              }}
            >
              <Field label="Nombre">
                <Input name="name" required placeholder="Plan Padrino La Voz de Jesús" />
              </Field>
              <Field label="Descripción">
                <Input name="description" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Aporte mensual">
                  <Input
                    name="monthlyAmount"
                    type="number"
                    min={1000}
                    defaultValue={50000}
                    required
                  />
                </Field>
                <Field label="Día límite">
                  <Input name="dueDay" type="number" min={1} max={28} defaultValue={5} required />
                </Field>
                <Field label="Fecha inicial">
                  <Input name="startsOn" type="date" required />
                </Field>
                <Field label="Fecha final (opcional)">
                  <Input name="endsOn" type="date" />
                </Field>
              </div>
              <Button disabled={planMutation.isPending}>
                <Plus className="mr-1 h-4 w-4" /> Crear campaña
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registrar padrino</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                sponsorMutation.mutate(new FormData(event.currentTarget));
              }}
            >
              <Field label="Campaña">
                <select
                  name="planId"
                  required
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Seleccionar…</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre">
                  <Input name="name" required />
                </Field>
                <Field label="Teléfono">
                  <Input name="phone" required />
                </Field>
                <Field label="Ciudad">
                  <Input name="city" />
                </Field>
                <Field label="Correo">
                  <Input name="email" type="email" />
                </Field>
                <Field label="Aporte mensual">
                  <Input
                    name="monthlyAmount"
                    type="number"
                    min={1000}
                    defaultValue={50000}
                    required
                  />
                </Field>
                <Field label="Próximo aporte">
                  <Input name="nextDueOn" type="date" required />
                </Field>
              </div>
              <Button disabled={sponsorMutation.isPending || plans.length === 0}>
                Registrar padrino
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Padrinos registrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sponsors.length === 0 && (
            <p className="text-sm text-muted-foreground">Aún no hay padrinos.</p>
          )}
          {sponsors.map((sponsor) => (
            <div
              key={sponsor.id}
              className="flex flex-col gap-3 rounded-xl border border-border p-4 md:flex-row md:items-center"
            >
              <div className="flex-1">
                <p className="font-semibold">{sponsor.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCOP(sponsor.monthly_amount)} mensual · próximo aporte {sponsor.next_due_on}
                </p>
              </div>
              <Button variant="outline" asChild>
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={buildWhatsAppUrl(
                    sponsor.phone,
                    `🙏 Hola ${sponsor.name}. Te recordamos tu aporte de ${formatCOP(sponsor.monthly_amount)} al Plan Padrino de La Voz de Jesús. Fecha: ${sponsor.next_due_on}. ¡Gracias por sostener esta misión! 💛`,
                  )}
                >
                  <MessageCircle className="mr-1 h-4 w-4" /> Recordar
                </a>
              </Button>
              <Button
                onClick={() => {
                  const raw = prompt("Valor recibido", String(sponsor.monthly_amount));
                  if (!raw) return;
                  void registerContribution({
                    data: { sponsorId: sponsor.id, amount: Number(raw), reference: "" },
                  })
                    .then(() => {
                      toast.success("Aporte registrado.");
                      refresh();
                    })
                    .catch((error: Error) => toast.error(error.message));
                }}
              >
                Registrar aporte
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
