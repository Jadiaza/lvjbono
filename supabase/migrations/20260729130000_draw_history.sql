-- Preserve every official draw and identify it by date and draw number.
ALTER TABLE public.draws
  ADD COLUMN IF NOT EXISTS draw_date date,
  ADD COLUMN IF NOT EXISTS draw_number text;

UPDATE public.draws
SET
  draw_date = COALESCE(draw_date, created_at::date),
  draw_number = COALESCE(draw_number, 'Sin número')
WHERE draw_date IS NULL OR draw_number IS NULL;

ALTER TABLE public.draws
  ALTER COLUMN draw_date SET NOT NULL,
  ALTER COLUMN draw_number SET NOT NULL;

DROP INDEX IF EXISTS public.draws_one_per_raffle;

CREATE INDEX IF NOT EXISTS draws_raffle_history
  ON public.draws (raffle_id, draw_date DESC, created_at DESC);

DROP FUNCTION IF EXISTS public.register_draw(uuid, integer, integer, integer);

CREATE FUNCTION public.register_draw(
  _raffle_id uuid,
  _mayor integer,
  _seco1 integer,
  _seco2 integer,
  _draw_date date,
  _draw_number text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.raffles%ROWTYPE; modulus integer; matches jsonb; winners jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _draw_date IS NULL OR nullif(btrim(_draw_number), '') IS NULL THEN
    RAISE EXCEPTION 'draw_metadata_required';
  END IF;
  SELECT * INTO r FROM public.raffles WHERE id = _raffle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'raffle_not_found'; END IF;
  modulus := power(10, r.digitos)::integer;
  _mayor := ((_mayor % modulus) + modulus) % modulus;
  _seco1 := ((_seco1 % modulus) + modulus) % modulus;
  _seco2 := ((_seco2 % modulus) + modulus) % modulus;
  WITH candidates(prize, number, amount, priority) AS (
    VALUES ('Premio Mayor', _mayor, r.premio_mayor, 0),
      ('Seco 1', _seco1, r.premio_seco1, 1), ('Seco 2', _seco2, r.premio_seco2, 2),
      ('Aproximación Anterior', (_mayor - 1 + modulus) % modulus, r.premio_aprox_ant, 3),
      ('Aproximación Posterior', (_mayor + 1) % modulus, r.premio_aprox_pos, 4)
  ), ranked AS (
    SELECT c.*, row_number() OVER (PARTITION BY number ORDER BY amount DESC, priority ASC) = 1 AS paid
    FROM candidates c
  ), detailed AS (
    SELECT x.*, t.nombre, t.telefono, t.ciudad,
      coalesce(t.estado IN ('vendido','ganador'), false) AS vendido
    FROM ranked x LEFT JOIN public.tickets t ON t.raffle_id = _raffle_id AND t.numero = x.number
  )
  SELECT jsonb_agg(to_jsonb(d) ORDER BY priority) INTO matches FROM detailed d;

  UPDATE public.tickets SET estado = 'vendido', premio_ganado = null
  WHERE raffle_id = _raffle_id AND estado = 'ganador';
  WITH paid AS (
    SELECT (x->>'number')::integer number, x->>'prize' prize
    FROM jsonb_array_elements(matches) x
    WHERE (x->>'paid')::boolean AND (x->>'vendido')::boolean AND (x->>'amount')::numeric > 0
  )
  UPDATE public.tickets t SET estado = 'ganador', premio_ganado = p.prize
  FROM paid p WHERE t.raffle_id = _raffle_id AND t.numero = p.number AND t.estado = 'vendido';

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO winners FROM jsonb_array_elements(matches) x;
  INSERT INTO public.draws(
    raffle_id, premio_mayor_num, seco1_num, seco2_num, ganadores, draw_date, draw_number
  )
  VALUES (
    _raffle_id, _mayor, _seco1, _seco2, winners, _draw_date, btrim(_draw_number)
  );
  RETURN winners;
END;
$$;

REVOKE ALL ON FUNCTION public.register_draw(uuid, integer, integer, integer, date, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_draw(uuid, integer, integer, integer, date, text)
  TO authenticated, service_role;
