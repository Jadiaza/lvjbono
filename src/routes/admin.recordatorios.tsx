import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, CalendarClock, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useSelectedRaffle } from "@/hooks/use-selected-raffle";
import {
  adminGetReminderCenter,
  adminMarkReminderSent,
  adminQueueSponsorReminders,
  adminSaveReminderSettings,
} from "@/lib/raffle.functions";
import { buildWhatsAppUrl, padNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/recordatorios")({
  component: ReminderCenter,
});

const DEFAULT_MESSAGE =
  "🙏 Hola {nombre}. Te recordamos tu aporte de {monto} para {campana}. Fecha límite: {fecha}. Saldo pendiente: {saldo}. ¡Gracias por apoyar esta obra! 💛";

function ReminderCenter() {
  const qc = useQueryClient();
  const { id: raffleId } = useSelectedRaffle();
  const getCenter = useServerFn(adminGetReminderCenter);
  const saveSettings = useServerFn(adminSaveReminderSettings);
  const queueReminders = useServerFn(adminQueueSponsorReminders);
  const markSent = useServerFn(adminMarkReminderSent);
  const query = useQuery({
    queryKey: ["reminder-center", raffleId],
    queryFn: () => getCenter({ data: { raffleId: raffleId! } }),
    enabled: !!raffleId,
  });
  const settings = query.data?.settings;

  const refresh = () => qc.invalidateQueries({ queryKey: ["reminder-center", raffleId] });
  const save = useMutation({
    mutationFn: (form: FormData) =>
      saveSettings({
        data: {
          raffleId: raffleId!,
          enabled: form.get("enabled") === "on",
          daysBefore: Number(form.get("daysBefore")),
          daysAfter: Number(form.get("daysAfter")),
          messageTemplate: String(form.get("messageTemplate")),
        },
      }),
    onSuccess: () => {
      toast.success("Programación guardada.");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const queue = useMutation({
    mutationFn: (form: FormData) => {
      const value = String(form.get("dueAt") ?? "");
      return queueReminders({
        data: { raffleId: raffleId!, dueAt: value ? new Date(value).toISOString() : null },
      });
    },
    onSuccess: ({ count }) => {
      toast.success(`${count} recordatorio(s) programado(s).`);
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  if (!raffleId) return <p>Selecciona un cartón para administrar sus recordatorios.</p>;

  const reminders = query.data?.reminders ?? [];
  const due = reminders.filter(
    (item) => item.status === "pending" && new Date(item.scheduled_for) <= new Date(),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Recordatorios de aportes</h1>
        <p className="text-sm text-muted-foreground">
          Programa avisos para padrinos y participantes que aún tengan saldo pendiente.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-brand" /> Programación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate(new FormData(event.currentTarget));
              }}
            >
              <label className="flex items-center justify-between gap-3">
                <span>Activar recordatorios</span>
                <Switch name="enabled" defaultChecked={settings?.enabled ?? true} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="daysBefore">Días antes</Label>
                  <Input
                    id="daysBefore"
                    name="daysBefore"
                    type="number"
                    min={0}
                    max={30}
                    defaultValue={settings?.days_before ?? 3}
                  />
                </div>
                <div>
                  <Label htmlFor="daysAfter">Días después</Label>
                  <Input
                    id="daysAfter"
                    name="daysAfter"
                    type="number"
                    min={0}
                    max={30}
                    defaultValue={settings?.days_after ?? 3}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="messageTemplate">Mensaje</Label>
                <Textarea
                  id="messageTemplate"
                  name="messageTemplate"
                  rows={6}
                  defaultValue={settings?.message_template ?? DEFAULT_MESSAGE}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Variables: {"{nombre}"}, {"{monto}"}, {"{campana}"}, {"{fecha}"} y {"{saldo}"}.
                </p>
              </div>
              <Button type="submit" disabled={save.isPending}>
                Guardar programación
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-brand" /> Preparar próxima cuota
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                queue.mutate(new FormData(event.currentTarget));
              }}
            >
              <div>
                <Label htmlFor="dueAt">Fecha y hora límite</Label>
                <Input id="dueAt" name="dueAt" type="datetime-local" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Si se deja vacía, se toma el próximo sorteo programado.
                </p>
              </div>
              <Button type="submit" disabled={queue.isPending || !settings?.enabled}>
                Generar recordatorios
              </Button>
            </form>
            <div className="mt-5 rounded-xl border border-border bg-secondary/40 p-4">
              <strong className="text-2xl text-brand">{due.length}</strong>
              <p className="text-sm text-muted-foreground">mensajes pendientes para enviar ahora</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cola de mensajes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reminders.length === 0 && (
            <p className="text-sm text-muted-foreground">Todavía no hay recordatorios generados.</p>
          )}
          {reminders.map((reminder) => {
            const ticket = reminder.ticket;
            const canSend = reminder.status === "pending";
            return (
              <div
                key={reminder.id}
                className="flex flex-col gap-3 rounded-xl border border-border p-4 md:flex-row md:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {ticket?.nombre ?? "Participante"} · #
                    {ticket ? padNumber(ticket.numero, 3) : "---"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(reminder.scheduled_for).toLocaleString("es-CO")} · {reminder.status}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm">{reminder.message}</p>
                </div>
                {canSend && ticket?.telefono && (
                  <Button
                    asChild
                    onClick={() => {
                      void markSent({ data: { reminderId: reminder.id } }).then(refresh);
                    }}
                  >
                    <a
                      href={buildWhatsAppUrl(ticket.telefono, reminder.message)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="mr-2 h-4 w-4" /> Enviar
                    </a>
                  </Button>
                )}
                {reminder.status === "sent" && (
                  <span className="inline-flex items-center gap-1 text-sm text-success">
                    <Check className="h-4 w-4" /> Enviado
                  </span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
