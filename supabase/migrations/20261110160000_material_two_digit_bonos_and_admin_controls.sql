-- Add a two-digit material-prize campaign using the existing bono lifecycle.
-- Existing standard raffles and dual three-digit bonos keep their current data.

ALTER TABLE public.raffles
  ADD COLUMN IF NOT EXISTS bono_prize_value integer;

ALTER TABLE public.raffles
  DROP CONSTRAINT IF EXISTS raffles_raffle_mode_check;
ALTER TABLE public.raffles
  ADD CONSTRAINT raffles_raffle_mode_check
  CHECK (raffle_mode IN ('standard', 'dual_bono', 'material_2d'));

ALTER TABLE public.raffles
  DROP CONSTRAINT IF EXISTS raffles_bono_configuration_check;
ALTER TABLE public.raffles
  ADD CONSTRAINT raffles_bono_configuration_check CHECK (
    (bono_prize_value IS NULL OR bono_prize_value >= 0)
    AND (
      raffle_mode = 'standard'
      OR (
        raffle_mode = 'dual_bono'
        AND digitos = 3
        AND bono_numbers_per_ticket = 2
        AND bono_total BETWEEN 1 AND 500
        AND bono_total * bono_numbers_per_ticket <= 1000
      )
      OR (
        raffle_mode = 'material_2d'
        AND digitos = 2
        AND bono_numbers_per_ticket = 1
        AND bono_total = 100
      )
    )
  );

CREATE OR REPLACE FUNCTION public.validate_raffle_bono_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  campaign public.raffles%ROWTYPE;
  bono_raffle_id uuid;
BEGIN
  SELECT raffle_id INTO bono_raffle_id
  FROM public.raffle_bonos
  WHERE id = NEW.bono_id;
  IF NOT FOUND OR bono_raffle_id <> NEW.raffle_id THEN
    RAISE EXCEPTION 'invalid_bono_campaign';
  END IF;

  SELECT * INTO campaign
  FROM public.raffles
  WHERE id = NEW.raffle_id;
  IF NOT FOUND OR campaign.raffle_mode NOT IN ('dual_bono', 'material_2d') THEN
    RAISE EXCEPTION 'invalid_bono_campaign';
  END IF;
  IF NEW.option_number > campaign.bono_numbers_per_ticket
    OR NEW.numero < 0
    OR NEW.numero >= power(10, campaign.digitos)::integer THEN
    RAISE EXCEPTION 'invalid_bono_number';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS raffle_bono_numbers_validate ON public.raffle_bono_numbers;
CREATE TRIGGER raffle_bono_numbers_validate
BEFORE INSERT OR UPDATE OF raffle_id, bono_id, option_number, numero
ON public.raffle_bono_numbers
FOR EACH ROW EXECUTE FUNCTION public.validate_raffle_bono_number();

CREATE OR REPLACE FUNCTION public.generate_dual_bonos(
  _raffle_id uuid,
  _total_bonos integer DEFAULT 500
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  campaign public.raffles%ROWTYPE;
  number_count integer;
  generated_count integer;
BEGIN
  SELECT * INTO campaign
  FROM public.raffles
  WHERE id = _raffle_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'raffle_not_found'; END IF;

  IF campaign.raffle_mode = 'dual_bono'
    AND campaign.digitos = 3
    AND campaign.bono_numbers_per_ticket = 2
    AND _total_bonos BETWEEN 1 AND 500 THEN
    number_count := 1000;
  ELSIF campaign.raffle_mode = 'material_2d'
    AND campaign.digitos = 2
    AND campaign.bono_numbers_per_ticket = 1
    AND campaign.bono_total = 100
    AND _total_bonos = 100 THEN
    number_count := 100;
  ELSE
    RAISE EXCEPTION 'invalid_bono_campaign';
  END IF;

  IF campaign.bono_total <> _total_bonos
    OR _total_bonos * campaign.bono_numbers_per_ticket > number_count THEN
    RAISE EXCEPTION 'invalid_bono_total';
  END IF;
  IF EXISTS (SELECT 1 FROM public.raffle_bonos WHERE raffle_id = _raffle_id) THEN
    RAISE EXCEPTION 'bonos_already_generated';
  END IF;

  WITH inserted AS (
    INSERT INTO public.raffle_bonos (raffle_id, serial, sale_value)
    SELECT _raffle_id, n, campaign.valor_boleta
    FROM pg_catalog.generate_series(1, _total_bonos) AS n
    RETURNING id, serial
  ), shuffled AS (
    SELECT
      n,
      pg_catalog.row_number() OVER (ORDER BY pg_catalog.random(), n) AS position
    FROM pg_catalog.generate_series(0, number_count - 1) AS n
  )
  INSERT INTO public.raffle_bono_numbers (raffle_id, bono_id, option_number, numero)
  SELECT
    _raffle_id,
    i.id,
    (((s.position - 1) % campaign.bono_numbers_per_ticket) + 1)::smallint,
    s.n::smallint
  FROM shuffled s
  JOIN inserted i
    ON i.serial = ((s.position - 1) / campaign.bono_numbers_per_ticket) + 1
  WHERE s.position <= _total_bonos * campaign.bono_numbers_per_ticket;

  INSERT INTO public.raffle_bono_events (raffle_id, bono_id, event_type, to_status)
  SELECT _raffle_id, id, 'generado', 'disponible'
  FROM public.raffle_bonos
  WHERE raffle_id = _raffle_id;

  SELECT count(*) INTO generated_count
  FROM public.raffle_bonos
  WHERE raffle_id = _raffle_id;
  RETURN generated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_dual_bonos(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_dual_bonos(uuid, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.admin_update_raffle_bono(
  _bono_id uuid,
  _actor_user_id uuid,
  _serial integer,
  _numbers jsonb,
  _buyer_name text,
  _buyer_phone text,
  _buyer_city text,
  _buyer_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_bono public.raffle_bonos%ROWTYPE;
  campaign public.raffles%ROWTYPE;
  old_numbers integer[];
  new_numbers integer[];
  numbers_changed boolean;
  identity_changed boolean;
BEGIN
  IF NOT public.has_role(_actor_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _serial < 1 OR _buyer_name IS NOT NULL AND length(_buyer_name) > 120
    OR _buyer_phone IS NOT NULL AND length(_buyer_phone) > 30
    OR _buyer_city IS NOT NULL AND length(_buyer_city) > 100
    OR _buyer_notes IS NOT NULL AND length(_buyer_notes) > 500 THEN
    RAISE EXCEPTION 'invalid_bono_data';
  END IF;
  IF jsonb_typeof(_numbers) <> 'array' THEN RAISE EXCEPTION 'invalid_bono_numbers'; END IF;

  SELECT * INTO current_bono
  FROM public.raffle_bonos
  WHERE id = _bono_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bono_not_found'; END IF;
  SELECT * INTO campaign
  FROM public.raffles
  WHERE id = current_bono.raffle_id
  FOR SHARE;
  IF NOT FOUND OR campaign.raffle_mode NOT IN ('dual_bono', 'material_2d') THEN
    RAISE EXCEPTION 'invalid_bono_campaign';
  END IF;

  IF _serial > campaign.bono_total THEN RAISE EXCEPTION 'invalid_bono_serial'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.raffle_bonos
    WHERE raffle_id = current_bono.raffle_id
      AND serial = _serial
      AND id <> current_bono.id
  ) THEN
    RAISE EXCEPTION 'bono_serial_conflict';
  END IF;

  SELECT coalesce(array_agg(numero ORDER BY option_number), ARRAY[]::integer[])
  INTO old_numbers
  FROM public.raffle_bono_numbers
  WHERE bono_id = current_bono.id;
  SELECT coalesce(array_agg(value::integer ORDER BY ordinality), ARRAY[]::integer[])
  INTO new_numbers
  FROM jsonb_array_elements_text(_numbers) WITH ORDINALITY AS item(value, ordinality);

  IF cardinality(new_numbers) <> campaign.bono_numbers_per_ticket
    OR (
      SELECT count(DISTINCT item.value)
      FROM unnest(new_numbers) AS item(value)
    ) <> cardinality(new_numbers)
    OR EXISTS (
      SELECT 1 FROM unnest(new_numbers) AS item(value)
      WHERE item.value < 0 OR item.value >= power(10, campaign.digitos)::integer
    ) THEN
    RAISE EXCEPTION 'invalid_bono_numbers';
  END IF;
  numbers_changed := old_numbers IS DISTINCT FROM new_numbers;
  identity_changed := current_bono.serial <> _serial OR numbers_changed;

  IF identity_changed AND (
    current_bono.sale_id IS NOT NULL
    OR current_bono.amount_paid > 0
    OR current_bono.status IN ('vendido', 'pagado')
  ) THEN
    RAISE EXCEPTION 'bono_financial_history_locked';
  END IF;
  IF current_bono.sale_id IS NOT NULL AND (_buyer_name IS NULL OR _buyer_phone IS NULL) THEN
    RAISE EXCEPTION 'invalid_bono_data';
  END IF;

  IF numbers_changed AND EXISTS (
    SELECT 1
    FROM public.raffle_bono_numbers n
    WHERE n.raffle_id = current_bono.raffle_id
      AND n.numero = ANY(new_numbers)
      AND n.bono_id <> current_bono.id
  ) THEN
    RAISE EXCEPTION 'bono_number_conflict';
  END IF;

  UPDATE public.raffle_bonos
  SET serial = _serial,
      buyer_name = _buyer_name,
      buyer_phone = _buyer_phone,
      buyer_city = _buyer_city,
      buyer_notes = _buyer_notes
  WHERE id = current_bono.id;

  IF numbers_changed THEN
    DELETE FROM public.raffle_bono_numbers WHERE bono_id = current_bono.id;
    INSERT INTO public.raffle_bono_numbers (raffle_id, bono_id, option_number, numero)
    SELECT
      current_bono.raffle_id,
      current_bono.id,
      item.ordinality::smallint,
      item.value::smallint
    FROM jsonb_array_elements_text(_numbers) WITH ORDINALITY AS item(value, ordinality);
  END IF;

  IF current_bono.sale_id IS NOT NULL THEN
    UPDATE public.raffle_bono_sales
    SET buyer_name = _buyer_name,
        buyer_phone = coalesce(_buyer_phone, ''),
        buyer_city = _buyer_city,
        buyer_notes = _buyer_notes
    WHERE id = current_bono.sale_id;
  END IF;

  INSERT INTO public.raffle_bono_events (
    raffle_id, bono_id, actor_user_id, responsible_id, event_type,
    from_status, to_status, metadata
  )
  VALUES (
    current_bono.raffle_id, current_bono.id, _actor_user_id,
    current_bono.current_responsible_id, 'edicion_admin',
    current_bono.status, current_bono.status,
    jsonb_build_object(
      'serial_before', current_bono.serial,
      'serial_after', _serial,
      'numbers_before', old_numbers,
      'numbers_after', new_numbers,
      'buyer_details_updated',
        current_bono.buyer_name IS DISTINCT FROM _buyer_name
        OR current_bono.buyer_phone IS DISTINCT FROM _buyer_phone
        OR current_bono.buyer_city IS DISTINCT FROM _buyer_city
        OR current_bono.buyer_notes IS DISTINCT FROM _buyer_notes
    )
  );
  RETURN jsonb_build_object('id', current_bono.id, 'serial', _serial, 'status', current_bono.status);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_raffle_bono(uuid, uuid, integer, jsonb, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_raffle_bono(uuid, uuid, integer, jsonb, text, text, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.admin_delete_raffle_bono(
  _bono_id uuid,
  _actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_bono public.raffle_bonos%ROWTYPE;
  had_history boolean;
  old_numbers integer[];
BEGIN
  IF NOT public.has_role(_actor_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO current_bono
  FROM public.raffle_bonos
  WHERE id = _bono_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bono_not_found'; END IF;
  IF current_bono.status = 'anulado' THEN RAISE EXCEPTION 'bono_already_void'; END IF;
  IF current_bono.status IN ('vendido', 'pagado')
    OR current_bono.sale_id IS NOT NULL
    OR current_bono.amount_paid > 0 THEN
    RAISE EXCEPTION 'bono_financial_history_locked';
  END IF;

  SELECT coalesce(array_agg(numero ORDER BY option_number), ARRAY[]::integer[])
  INTO old_numbers
  FROM public.raffle_bono_numbers
  WHERE bono_id = current_bono.id;
  SELECT
    EXISTS (SELECT 1 FROM public.raffle_bono_events WHERE bono_id = current_bono.id)
    OR EXISTS (SELECT 1 FROM public.raffle_bono_assignments WHERE bono_id = current_bono.id)
    OR current_bono.current_responsible_id IS NOT NULL
    OR current_bono.current_batch_id IS NOT NULL
  INTO had_history;

  IF NOT had_history AND current_bono.status IN ('disponible', 'devuelto') THEN
    INSERT INTO public.raffle_bono_events (
      raffle_id, bono_id, actor_user_id, event_type, from_status, to_status, metadata
    )
    VALUES (
      current_bono.raffle_id, NULL, _actor_user_id, 'eliminacion_fisica_admin',
      current_bono.status, NULL,
      jsonb_build_object(
        'deleted_bono_id', current_bono.id,
        'serial', current_bono.serial,
        'numbers', old_numbers
      )
    );
    DELETE FROM public.raffle_bonos WHERE id = current_bono.id;
    RETURN jsonb_build_object('deleted', true, 'status', NULL);
  END IF;

  UPDATE public.raffle_bono_assignments
  SET ended_at = now(), end_reason = 'anulado_admin'
  WHERE bono_id = current_bono.id AND ended_at IS NULL;
  UPDATE public.raffle_bonos
  SET status = 'anulado',
      current_responsible_id = NULL,
      current_batch_id = NULL,
      reserved_at = NULL,
      reservation_expires_at = NULL
  WHERE id = current_bono.id;
  INSERT INTO public.raffle_bono_events (
    raffle_id, bono_id, actor_user_id, responsible_id, event_type,
    from_status, to_status, metadata
  )
  VALUES (
    current_bono.raffle_id, current_bono.id, _actor_user_id,
    current_bono.current_responsible_id, 'anulado_admin',
    current_bono.status, 'anulado',
    jsonb_build_object('serial', current_bono.serial, 'numbers', old_numbers)
  );
  RETURN jsonb_build_object('deleted', false, 'status', 'anulado');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_raffle_bono(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_raffle_bono(uuid, uuid)
  TO service_role;
