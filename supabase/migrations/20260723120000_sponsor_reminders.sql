-- Recordatorios de aportes para padrinos, bonos solidarios y rifas por cuotas.
CREATE TABLE IF NOT EXISTS public.sponsor_reminder_settings (
  raffle_id uuid PRIMARY KEY REFERENCES public.raffles(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  days_before integer NOT NULL DEFAULT 3 CHECK (days_before BETWEEN 0 AND 30),
  days_after integer NOT NULL DEFAULT 3 CHECK (days_after BETWEEN 0 AND 30),
  default_due_day integer CHECK (default_due_day BETWEEN 1 AND 28),
  message_template text NOT NULL DEFAULT
    '🙏 Hola {nombre}. Te recordamos tu aporte de {monto} para {campana}. Fecha límite: {fecha}. Saldo pendiente: {saldo}. ¡Gracias por apoyar esta obra! 💛',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sponsor_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  kind text NOT NULL CHECK (kind IN ('before_due', 'due', 'overdue', 'confirmation')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  channel text NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'email')),
  message text NOT NULL,
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, scheduled_for, kind)
);

CREATE INDEX IF NOT EXISTS sponsor_reminders_due_idx
  ON public.sponsor_reminders (status, scheduled_for);
CREATE INDEX IF NOT EXISTS sponsor_reminders_raffle_idx
  ON public.sponsor_reminders (raffle_id, scheduled_for);

ALTER TABLE public.sponsor_reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage reminder settings" ON public.sponsor_reminder_settings;
CREATE POLICY "Admins manage reminder settings"
ON public.sponsor_reminder_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage reminders" ON public.sponsor_reminders;
CREATE POLICY "Admins manage reminders"
ON public.sponsor_reminders FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.queue_sponsor_reminders(
  _raffle_id uuid,
  _due_at timestamptz DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.sponsor_reminder_settings%ROWTYPE;
  due_at timestamptz;
  inserted_count integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO cfg FROM public.sponsor_reminder_settings WHERE raffle_id = _raffle_id;
  IF NOT FOUND OR NOT cfg.enabled THEN RETURN 0; END IF;

  SELECT COALESCE(
    _due_at,
    (
      SELECT min(draw_at) FROM public.raffle_draw_stages
      WHERE raffle_id = _raffle_id AND completed_at IS NULL
    ),
    r.fecha_sorteo::timestamptz,
    now() + interval '30 days'
  ) INTO due_at
  FROM public.raffles r WHERE r.id = _raffle_id;

  INSERT INTO public.sponsor_reminders
    (raffle_id, ticket_id, scheduled_for, kind, message)
  SELECT
    t.raffle_id,
    t.id,
    schedule.scheduled_for,
    schedule.kind,
    replace(replace(replace(replace(replace(
      cfg.message_template,
      '{nombre}', coalesce(t.nombre, 'padrino')),
      '{monto}', trim(to_char(coalesce(r.installment_amount, r.valor_boleta), 'FM$999G999G999'))),
      '{campana}', r.nombre),
      '{fecha}', to_char(due_at AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY')),
      '{saldo}', trim(to_char(greatest(r.valor_boleta - t.total_abonado, 0), 'FM$999G999G999')))
  FROM public.tickets t
  JOIN public.raffles r ON r.id = t.raffle_id
  CROSS JOIN LATERAL (
    VALUES
      (due_at - make_interval(days => cfg.days_before), 'before_due'),
      (due_at, 'due'),
      (due_at + make_interval(days => cfg.days_after), 'overdue')
  ) AS schedule(scheduled_for, kind)
  WHERE t.raffle_id = _raffle_id
    AND t.estado = 'reservado'
    AND nullif(regexp_replace(coalesce(t.telefono, ''), '\D', '', 'g'), '') IS NOT NULL
    AND t.total_abonado < r.valor_boleta
  ON CONFLICT (ticket_id, scheduled_for, kind) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_sponsor_reminders(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_sponsor_reminders(uuid, timestamptz) TO authenticated;
