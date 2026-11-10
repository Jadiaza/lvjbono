-- Harden bono uniqueness, identity locks, authenticated admin actions, and
-- deletion semantics without rewriting existing records.

DO $$
DECLARE
  unique_index_exists boolean;
  conflicting_rows text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index i
    WHERE i.indrelid = 'public.raffle_bono_numbers'::regclass
      AND i.indisunique
      AND i.indisvalid
      AND i.indisready
      AND i.indpred IS NULL
      AND i.indnkeyatts = 2
      AND ARRAY(
        SELECT a.attname::text
        FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY AS key_column(attnum, ordinality)
        JOIN pg_catalog.pg_attribute a
          ON a.attrelid = i.indrelid
         AND a.attnum = key_column.attnum
        WHERE key_column.ordinality <= i.indnkeyatts
        ORDER BY a.attname::text
      ) = ARRAY['numero', 'raffle_id']::text[]
  ) INTO unique_index_exists;

  IF NOT unique_index_exists THEN
    SELECT pg_catalog.string_agg(
      pg_catalog.format('(raffle_id=%s, numero=%s, count=%s)', raffle_id, numero, row_count),
      '; '
    )
    INTO conflicting_rows
    FROM (
      SELECT raffle_id, numero, count(*) AS row_count
      FROM public.raffle_bono_numbers
      GROUP BY raffle_id, numero
      HAVING count(*) > 1
      ORDER BY raffle_id, numero
      LIMIT 20
    ) duplicates;

    IF conflicting_rows IS NOT NULL THEN
      RAISE EXCEPTION USING
        MESSAGE = 'duplicate raffle_bono_numbers exist; resolve them manually before applying this migration',
        DETAIL = conflicting_rows;
    END IF;

    CREATE UNIQUE INDEX raffle_bono_numbers_raffle_numero_uidx
      ON public.raffle_bono_numbers (raffle_id, numero);
  END IF;
END;
$$;

DO $$
DECLARE
  unique_index_exists boolean;
  conflicting_rows text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index i
    WHERE i.indrelid = 'public.raffle_bonos'::regclass
      AND i.indisunique
      AND i.indisvalid
      AND i.indisready
      AND i.indpred IS NULL
      AND i.indnkeyatts = 2
      AND ARRAY(
        SELECT a.attname::text
        FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY AS key_column(attnum, ordinality)
        JOIN pg_catalog.pg_attribute a
          ON a.attrelid = i.indrelid
         AND a.attnum = key_column.attnum
        WHERE key_column.ordinality <= i.indnkeyatts
        ORDER BY a.attname::text
      ) = ARRAY['raffle_id', 'serial']::text[]
  ) INTO unique_index_exists;

  IF NOT unique_index_exists THEN
    SELECT pg_catalog.string_agg(
      pg_catalog.format('(raffle_id=%s, serial=%s, count=%s)', raffle_id, serial, row_count),
      '; '
    )
    INTO conflicting_rows
    FROM (
      SELECT raffle_id, serial, count(*) AS row_count
      FROM public.raffle_bonos
      GROUP BY raffle_id, serial
      HAVING count(*) > 1
      ORDER BY raffle_id, serial
      LIMIT 20
    ) duplicates;

    IF conflicting_rows IS NOT NULL THEN
      RAISE EXCEPTION USING
        MESSAGE = 'duplicate raffle_bonos serials exist; resolve them manually before applying this migration',
        DETAIL = conflicting_rows;
    END IF;

    CREATE UNIQUE INDEX raffle_bonos_raffle_serial_uidx
      ON public.raffle_bonos (raffle_id, serial);
  END IF;
END;
$$;

DO $$
DECLARE
  inconsistent_rows text;
BEGIN
  SELECT pg_catalog.string_agg(
    pg_catalog.format('(number_id=%s, bono_id=%s, number_raffle_id=%s, bono_raffle_id=%s)',
      id, bono_id, number_raffle_id, bono_raffle_id),
    '; '
  )
  INTO inconsistent_rows
  FROM (
    SELECT number_row.id, number_row.bono_id,
      number_row.raffle_id AS number_raffle_id,
      bono.raffle_id AS bono_raffle_id
    FROM public.raffle_bono_numbers number_row
    JOIN public.raffle_bonos bono ON bono.id = number_row.bono_id
    WHERE bono.raffle_id <> number_row.raffle_id
    ORDER BY number_row.id
    LIMIT 20
  ) conflicts;

  IF inconsistent_rows IS NOT NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = 'raffle_bono_numbers contains rows assigned to a different campaign than their bono; resolve them manually before applying this migration',
      DETAIL = inconsistent_rows;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.raffle_bonos'::regclass
      AND conname = 'raffle_bonos_id_raffle_unique'
      AND contype IN ('u', 'p')
  ) THEN
    ALTER TABLE public.raffle_bonos
      ADD CONSTRAINT raffle_bonos_id_raffle_unique UNIQUE (id, raffle_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.raffle_bono_numbers'::regclass
      AND conname = 'raffle_bono_numbers_bono_campaign_fkey'
      AND contype = 'f'
  ) THEN
    ALTER TABLE public.raffle_bono_numbers
      ADD CONSTRAINT raffle_bono_numbers_bono_campaign_fkey
      FOREIGN KEY (bono_id, raffle_id)
      REFERENCES public.raffle_bonos (id, raffle_id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  ALTER TABLE public.raffle_bono_numbers
    VALIDATE CONSTRAINT raffle_bono_numbers_bono_campaign_fkey;
END;
$$;

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
  IF NEW.option_number < 1
    OR NEW.option_number > campaign.bono_numbers_per_ticket
    OR NEW.numero < 0
    OR NEW.numero >= power(10, campaign.digitos)::integer THEN
    RAISE EXCEPTION 'invalid_bono_number';
  END IF;
  RETURN NEW;
END;
$$;

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
  IF auth.uid() IS NULL
    OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

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
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_dual_bonos(uuid, integer)
  TO authenticated;

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
  violated_constraint text;
BEGIN
  IF auth.uid() IS NULL
    OR auth.uid() IS DISTINCT FROM _actor_user_id
    OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
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
    OR current_bono.status IN ('reservado', 'asignado', 'vendido', 'pagado')
    OR current_bono.current_responsible_id IS NOT NULL
    OR current_bono.current_batch_id IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.raffle_bono_assignments
      WHERE bono_id = current_bono.id
        AND ended_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'bono_identity_locked';
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
    current_bono.raffle_id, current_bono.id, auth.uid(),
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
EXCEPTION
  WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
    IF violated_constraint = 'raffle_bonos_raffle_id_serial_key'
      OR violated_constraint = 'raffle_bonos_raffle_serial_uidx'
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.pg_index i
        WHERE i.indexrelid = pg_catalog.to_regclass(
          pg_catalog.format('public.%I', violated_constraint)
        )
          AND i.indrelid = 'public.raffle_bonos'::regclass
          AND i.indisunique
          AND i.indpred IS NULL
          AND i.indnkeyatts = 2
          AND ARRAY(
            SELECT a.attname::text
            FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY AS key_column(attnum, ordinality)
            JOIN pg_catalog.pg_attribute a
              ON a.attrelid = i.indrelid
             AND a.attnum = key_column.attnum
            WHERE key_column.ordinality <= i.indnkeyatts
            ORDER BY a.attname::text
          ) = ARRAY['raffle_id', 'serial']::text[]
      ) THEN
      RAISE EXCEPTION 'bono_serial_conflict';
    ELSIF violated_constraint = 'raffle_bono_numbers_raffle_id_numero_key'
      OR violated_constraint = 'raffle_bono_numbers_raffle_numero_uidx'
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.pg_index i
        WHERE i.indexrelid = pg_catalog.to_regclass(
          pg_catalog.format('public.%I', violated_constraint)
        )
          AND i.indrelid = 'public.raffle_bono_numbers'::regclass
          AND i.indisunique
          AND i.indpred IS NULL
          AND i.indnkeyatts = 2
          AND ARRAY(
            SELECT a.attname::text
            FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY AS key_column(attnum, ordinality)
            JOIN pg_catalog.pg_attribute a
              ON a.attrelid = i.indrelid
             AND a.attnum = key_column.attnum
            WHERE key_column.ordinality <= i.indnkeyatts
            ORDER BY a.attname::text
          ) = ARRAY['numero', 'raffle_id']::text[]
      ) THEN
      RAISE EXCEPTION 'bono_number_conflict';
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_raffle_bono(uuid, uuid, integer, jsonb, text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_raffle_bono(uuid, uuid, integer, jsonb, text, text, text, text)
  TO authenticated;

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
  IF auth.uid() IS NULL
    OR auth.uid() IS DISTINCT FROM _actor_user_id
    OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
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
  IF current_bono.status = 'reservado'
    AND (
      current_bono.reservation_expires_at IS NULL
      OR current_bono.reservation_expires_at > now()
    ) THEN
    RAISE EXCEPTION 'bono_active_reservation_locked';
  END IF;

  SELECT coalesce(array_agg(numero ORDER BY option_number), ARRAY[]::integer[])
  INTO old_numbers
  FROM public.raffle_bono_numbers
  WHERE bono_id = current_bono.id;
  SELECT
    EXISTS (
      SELECT 1 FROM public.raffle_bono_events
      WHERE bono_id = current_bono.id
        AND event_type <> 'generado'
    )
    OR EXISTS (SELECT 1 FROM public.raffle_bono_assignments WHERE bono_id = current_bono.id)
    OR current_bono.status <> 'disponible'
    OR current_bono.current_responsible_id IS NOT NULL
    OR current_bono.current_batch_id IS NOT NULL
    OR current_bono.buyer_name IS NOT NULL
    OR current_bono.buyer_phone IS NOT NULL
    OR current_bono.buyer_city IS NOT NULL
    OR current_bono.buyer_notes IS NOT NULL
    OR current_bono.reserved_at IS NOT NULL
    OR current_bono.reservation_expires_at IS NOT NULL
  INTO had_history;

  IF NOT had_history THEN
    INSERT INTO public.raffle_bono_events (
      raffle_id, bono_id, actor_user_id, event_type, from_status, to_status, metadata
    )
    VALUES (
      current_bono.raffle_id, NULL, auth.uid(), 'eliminacion_fisica_admin',
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
    current_bono.raffle_id, current_bono.id, auth.uid(),
    current_bono.current_responsible_id, 'anulado_admin',
    current_bono.status, 'anulado',
    jsonb_build_object('serial', current_bono.serial, 'numbers', old_numbers)
  );
  RETURN jsonb_build_object('deleted', false, 'status', 'anulado');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_raffle_bono(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_raffle_bono(uuid, uuid)
  TO authenticated;
