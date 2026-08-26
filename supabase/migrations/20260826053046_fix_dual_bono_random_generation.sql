-- Fix dual bono generation in SECURITY DEFINER functions with an empty
-- search_path. gen_random_bytes may live in the extensions schema, so use the
-- explicitly qualified PostgreSQL random function for the shuffle instead.

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
  generated_count integer;
BEGIN
  SELECT * INTO campaign
  FROM public.raffles
  WHERE id = _raffle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'raffle_not_found';
  END IF;
  IF campaign.raffle_mode <> 'dual_bono' OR campaign.digitos <> 3 THEN
    RAISE EXCEPTION 'invalid_dual_bono_campaign';
  END IF;
  IF _total_bonos < 1 OR _total_bonos > 500 OR _total_bonos * 2 > 1000 THEN
    RAISE EXCEPTION 'invalid_bono_total';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.raffle_bonos WHERE raffle_id = _raffle_id
  ) THEN
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
      pg_catalog.row_number() OVER (
        ORDER BY pg_catalog.random(), n
      ) AS position
    FROM pg_catalog.generate_series(0, 999) AS n
  )
  INSERT INTO public.raffle_bono_numbers (
    raffle_id,
    bono_id,
    option_number,
    numero
  )
  SELECT
    _raffle_id,
    i.id,
    ((s.position - 1) % 2 + 1)::smallint,
    s.n::smallint
  FROM shuffled s
  JOIN inserted i ON i.serial = ((s.position - 1) / 2) + 1
  WHERE s.position <= _total_bonos * 2;

  INSERT INTO public.raffle_bono_events (
    raffle_id,
    bono_id,
    event_type,
    to_status
  )
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
