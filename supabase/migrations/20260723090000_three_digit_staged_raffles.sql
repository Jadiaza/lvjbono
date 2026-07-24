-- Three-digit staged raffles:
-- customer-selected main number, system-assigned alternate number,
-- cumulative installments and scheduled alternate draws.

ALTER TABLE public.raffles
  ADD COLUMN IF NOT EXISTS staged_payments boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS installment_amount integer;

ALTER TABLE public.raffles DROP CONSTRAINT IF EXISTS raffles_staged_payments_check;
ALTER TABLE public.raffles ADD CONSTRAINT raffles_staged_payments_check CHECK (
  NOT staged_payments OR (
    digitos = 3
    AND installment_amount IS NOT NULL
    AND installment_amount > 0
    AND installment_amount <= valor_boleta
  )
);

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS numero_alterno integer,
  ADD COLUMN IF NOT EXISTS total_abonado integer NOT NULL DEFAULT 0;

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_numero_alterno_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_numero_alterno_check
  CHECK (numero_alterno IS NULL OR numero_alterno BETWEEN 0 AND 999);

CREATE UNIQUE INDEX IF NOT EXISTS tickets_raffle_alternate_unique
  ON public.tickets (raffle_id, numero_alterno)
  WHERE numero_alterno IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ticket_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  reference text NOT NULL,
  payment_method text,
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  validated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_payments_ticket_paid_at
  ON public.ticket_payments (ticket_id, paid_at);

ALTER TABLE public.ticket_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage ticket payments" ON public.ticket_payments;
CREATE POLICY "Admins manage ticket payments" ON public.ticket_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_payments TO authenticated;
GRANT ALL ON public.ticket_payments TO service_role;

CREATE TABLE IF NOT EXISTS public.raffle_draw_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  name text NOT NULL,
  draw_at timestamptz NOT NULL,
  minimum_paid integer NOT NULL CHECK (minimum_paid > 0),
  prize_amount integer NOT NULL DEFAULT 0 CHECK (prize_amount >= 0),
  result_number integer CHECK (result_number BETWEEN 0 AND 999),
  winner_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (raffle_id, name)
);

CREATE INDEX IF NOT EXISTS raffle_draw_stages_raffle_date
  ON public.raffle_draw_stages (raffle_id, draw_at);

ALTER TABLE public.raffle_draw_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage raffle stages" ON public.raffle_draw_stages;
CREATE POLICY "Admins manage raffle stages" ON public.raffle_draw_stages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.raffle_draw_stages TO authenticated;
GRANT ALL ON public.raffle_draw_stages TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_raffle_stages(_raffle_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  draw_at timestamptz,
  minimum_paid integer,
  prize_amount integer,
  result_number integer,
  completed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.name, s.draw_at, s.minimum_paid, s.prize_amount,
    s.result_number, s.completed_at
  FROM public.raffle_draw_stages s
  JOIN public.raffles r ON r.id = s.raffle_id
  WHERE s.raffle_id = _raffle_id AND r.activa
  ORDER BY s.draw_at;
$$;
REVOKE ALL ON FUNCTION public.get_public_raffle_stages(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_raffle_stages(uuid)
  TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.reserve_ticket(uuid, integer, text, text, text, text, text);
CREATE FUNCTION public.reserve_ticket(
  _raffle_id uuid, _numero integer, _nombre text, _telefono text,
  _ciudad text, _email text, _medio_pago text
)
RETURNS TABLE (codigo_verificacion uuid, numero integer, numero_alterno integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r public.raffles%ROWTYPE;
  alternate integer;
BEGIN
  SELECT * INTO r FROM public.raffles WHERE id = _raffle_id AND activa FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'raffle_unavailable'; END IF;
  IF _numero < 0 OR _numero >= power(10, r.digitos)::integer THEN
    RAISE EXCEPTION 'invalid_number';
  END IF;

  IF r.digitos = 3 AND r.staged_payments THEN
    SELECT candidate INTO alternate
    FROM generate_series(0, 999) candidate
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tickets used
      WHERE used.raffle_id = _raffle_id
        AND used.numero_alterno = candidate
        AND used.estado <> 'disponible'
    )
    ORDER BY random()
    LIMIT 1;
    IF alternate IS NULL THEN RAISE EXCEPTION 'alternate_numbers_exhausted'; END IF;
  END IF;

  RETURN QUERY
  UPDATE public.tickets t SET
    estado = 'reservado',
    nombre = _nombre,
    telefono = _telefono,
    ciudad = _ciudad,
    email = nullif(_email, ''),
    medio_pago = _medio_pago,
    valor_pagado = r.valor_boleta,
    numero_alterno = alternate,
    total_abonado = 0,
    monto_recibido = 0,
    fecha_compra = now()
  WHERE t.raffle_id = _raffle_id
    AND t.numero = _numero
    AND t.estado = 'disponible'
  RETURNING t.codigo_verificacion, t.numero, t.numero_alterno;

  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_unavailable'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_ticket(uuid, integer, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_ticket(uuid, integer, text, text, text, text, text) TO service_role;

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
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  SELECT * INTO t FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND OR t.estado = 'disponible' THEN RAISE EXCEPTION 'ticket_unavailable'; END IF;
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

CREATE OR REPLACE FUNCTION public.backfill_alternate_numbers(_raffle_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item record;
  alternate integer;
  assigned integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.raffles
    WHERE id = _raffle_id AND digitos = 3 AND staged_payments
  ) THEN
    RAISE EXCEPTION 'staged_raffle_required';
  END IF;

  FOR item IN
    SELECT id FROM public.tickets
    WHERE raffle_id = _raffle_id
      AND estado <> 'disponible'
      AND numero_alterno IS NULL
    FOR UPDATE
  LOOP
    SELECT candidate INTO alternate
    FROM generate_series(0, 999) candidate
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tickets used
      WHERE used.raffle_id = _raffle_id AND used.numero_alterno = candidate
    )
    ORDER BY random()
    LIMIT 1;
    IF alternate IS NULL THEN RAISE EXCEPTION 'alternate_numbers_exhausted'; END IF;
    UPDATE public.tickets SET numero_alterno = alternate WHERE id = item.id;
    assigned := assigned + 1;
  END LOOP;
  RETURN assigned;
END;
$$;
REVOKE ALL ON FUNCTION public.backfill_alternate_numbers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_alternate_numbers(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.register_stage_draw(
  _stage_id uuid,
  _result integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  stage public.raffle_draw_stages%ROWTYPE;
  winner public.tickets%ROWTYPE;
  normalized integer;
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO stage FROM public.raffle_draw_stages WHERE id = _stage_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'stage_not_found'; END IF;
  IF stage.completed_at IS NOT NULL THEN RAISE EXCEPTION 'stage_already_completed'; END IF;
  IF now() < stage.draw_at THEN RAISE EXCEPTION 'stage_not_closed'; END IF;

  normalized := ((_result % 1000) + 1000) % 1000;
  SELECT t.* INTO winner
  FROM public.tickets t
  WHERE t.raffle_id = stage.raffle_id
    AND t.numero_alterno = normalized
    AND t.estado <> 'disponible'
    AND (
      SELECT coalesce(sum(p.amount), 0)
      FROM public.ticket_payments p
      WHERE p.ticket_id = t.id
        AND p.paid_at <= stage.draw_at
    ) >= stage.minimum_paid
  LIMIT 1;

  UPDATE public.raffle_draw_stages SET
    result_number = normalized,
    winner_ticket_id = winner.id,
    completed_at = now(),
    updated_at = now()
  WHERE id = stage.id;

  result := jsonb_build_object(
    'stage_id', stage.id,
    'name', stage.name,
    'number', normalized,
    'prize_amount', stage.prize_amount,
    'winner_ticket_id', winner.id,
    'winner_name', winner.nombre,
    'winner_phone', winner.telefono,
    'eligible', winner.id IS NOT NULL
  );
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.register_stage_draw(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_stage_draw(uuid, integer)
  TO authenticated, service_role;
