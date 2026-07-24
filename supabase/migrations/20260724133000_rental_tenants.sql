-- Alquiler temporal de Rifaya: cada organizador administra únicamente la rifa asignada.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'organizer';

ALTER TABLE public.raffles
  ADD COLUMN IF NOT EXISTS responsable text,
  ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS raffles_slug_unique
  ON public.raffles (lower(slug))
  WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.raffle_rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responsable text NOT NULL,
  prepaid_amount integer NOT NULL DEFAULT 0 CHECK (prepaid_amount >= 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT raffle_rentals_valid_period CHECK (ends_at > starts_at),
  UNIQUE (raffle_id, user_id)
);

CREATE INDEX IF NOT EXISTS raffle_rentals_user_period
  ON public.raffle_rentals (user_id, starts_at, ends_at);

ALTER TABLE public.raffle_rentals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.raffle_rentals TO authenticated;
GRANT ALL ON public.raffle_rentals TO service_role;

DROP POLICY IF EXISTS "Users view own raffle rentals" ON public.raffle_rentals;
CREATE POLICY "Users view own raffle rentals"
  ON public.raffle_rentals FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE OR REPLACE FUNCTION public.has_active_raffle_rental(
  _user_id uuid,
  _raffle_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.raffle_rentals rr
    WHERE rr.user_id = _user_id
      AND rr.raffle_id = _raffle_id
      AND rr.active
      AND now() >= rr.starts_at
      AND now() < rr.ends_at
  );
$$;

REVOKE ALL ON FUNCTION public.has_active_raffle_rental(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_raffle_rental(uuid, uuid)
  TO authenticated, service_role;

DROP TRIGGER IF EXISTS raffle_rentals_updated ON public.raffle_rentals;
CREATE TRIGGER raffle_rentals_updated
  BEFORE UPDATE ON public.raffle_rentals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Permitir que el organizador vigente registre cobros únicamente en su rifa.
CREATE OR REPLACE FUNCTION public.add_ticket_payment(
  _ticket_id uuid,
  _amount integer,
  _reference text,
  _notes text DEFAULT NULL
)
RETURNS TABLE (total_paid integer, ticket_status public.ticket_estado)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t public.tickets%ROWTYPE;
  r public.raffles%ROWTYPE;
  new_total integer;
  new_status public.ticket_estado;
BEGIN
  SELECT * INTO t FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND OR t.estado = 'disponible' THEN RAISE EXCEPTION 'ticket_unavailable'; END IF;

  IF NOT public.has_role(auth.uid(), 'admin')
     AND NOT public.has_active_raffle_rental(auth.uid(), t.raffle_id)
  THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  SELECT * INTO r FROM public.raffles WHERE id = t.raffle_id;
  IF NOT r.staged_payments AND t.total_abonado + _amount < r.valor_boleta THEN
    RAISE EXCEPTION 'full_payment_required';
  END IF;
  IF t.total_abonado + _amount > r.valor_boleta THEN
    RAISE EXCEPTION 'payment_exceeds_balance';
  END IF;

  INSERT INTO public.ticket_payments(
    ticket_id, amount, reference, payment_method, notes, validated_by
  ) VALUES (
    t.id, _amount, _reference, t.medio_pago, nullif(_notes, ''), auth.uid()
  );

  new_total := t.total_abonado + _amount;
  new_status := CASE
    WHEN new_total >= r.valor_boleta THEN 'vendido'::public.ticket_estado
    ELSE 'reservado'::public.ticket_estado
  END;

  UPDATE public.tickets SET
    total_abonado = new_total,
    monto_recibido = new_total,
    estado = new_status,
    referencia_pago = _reference,
    observaciones = nullif(_notes, ''),
    validado_por = auth.uid(),
    validado_at = now()
  WHERE id = t.id;

  RETURN QUERY SELECT new_total, new_status;
END;
$$;

REVOKE ALL ON FUNCTION public.add_ticket_payment(uuid, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_ticket_payment(uuid, integer, text, text)
  TO authenticated, service_role;
