-- Corrective, non-destructive hardening for ticket generation, public reads,
-- reservations, single-active raffle, draws, and first-admin bootstrap.

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_numero_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_numero_check CHECK (numero BETWEEN 0 AND 999);

DROP TRIGGER IF EXISTS raffles_seed_tickets ON public.raffles;
DROP TRIGGER IF EXISTS trg_seed_raffle_tickets ON public.raffles;
DROP TRIGGER IF EXISTS raffles_seed_tickets_once ON public.raffles;

CREATE OR REPLACE FUNCTION public.seed_raffle_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.digitos NOT IN (2, 3) THEN
    RAISE EXCEPTION 'digitos must be 2 or 3';
  END IF;
  INSERT INTO public.tickets (raffle_id, numero)
  SELECT NEW.id, n
  FROM generate_series(0, power(10, NEW.digitos)::integer - 1) AS n
  ON CONFLICT (raffle_id, numero) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER raffles_seed_tickets_once
AFTER INSERT ON public.raffles
FOR EACH ROW EXECUTE FUNCTION public.seed_raffle_tickets();

CREATE OR REPLACE FUNCTION public.validate_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE raffle_digits integer;
BEGIN
  SELECT digitos INTO raffle_digits FROM public.raffles WHERE id = NEW.raffle_id;
  IF raffle_digits IS NULL THEN RAISE EXCEPTION 'raffle does not exist'; END IF;
  IF NEW.numero < 0 OR NEW.numero >= power(10, raffle_digits)::integer THEN
    RAISE EXCEPTION 'ticket number outside raffle range';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tickets_validate_number ON public.tickets;
CREATE TRIGGER tickets_validate_number
BEFORE INSERT OR UPDATE OF raffle_id, numero ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.validate_ticket_number();

DROP VIEW IF EXISTS public.public_tickets;
REVOKE ALL ON public.tickets FROM anon;

CREATE OR REPLACE FUNCTION public.get_public_tickets(_raffle_id uuid)
RETURNS TABLE (raffle_id uuid, numero integer, estado public.ticket_estado, premio_ganado text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT t.raffle_id, t.numero, t.estado, t.premio_ganado
  FROM public.tickets t
  JOIN public.raffles r ON r.id = t.raffle_id
  WHERE t.raffle_id = _raffle_id AND r.activa;
$$;
REVOKE ALL ON FUNCTION public.get_public_tickets(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tickets(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reserve_ticket(
  _raffle_id uuid, _numero integer, _nombre text, _telefono text,
  _ciudad text, _email text, _medio_pago text
)
RETURNS TABLE (codigo_verificacion uuid, numero integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r public.raffles%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.raffles WHERE id = _raffle_id AND activa FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'raffle_unavailable'; END IF;
  IF _numero < 0 OR _numero >= power(10, r.digitos)::integer THEN RAISE EXCEPTION 'invalid_number'; END IF;
  RETURN QUERY
  UPDATE public.tickets t SET
    estado = 'reservado', nombre = _nombre, telefono = _telefono, ciudad = _ciudad,
    email = nullif(_email, ''), medio_pago = _medio_pago, valor_pagado = r.valor_boleta,
    fecha_compra = now()
  WHERE t.raffle_id = _raffle_id AND t.numero = _numero AND t.estado = 'disponible'
  RETURNING t.codigo_verificacion, t.numero;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_unavailable'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_ticket(uuid, integer, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_ticket(uuid, integer, text, text, text, text, text) TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS draws_one_per_raffle ON public.draws (raffle_id);
CREATE UNIQUE INDEX IF NOT EXISTS raffles_single_active ON public.raffles (activa) WHERE activa;

CREATE OR REPLACE FUNCTION public.set_active_raffle(_raffle_id uuid, _active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(731947);
  IF _active THEN UPDATE public.raffles SET activa = false WHERE activa AND id <> _raffle_id; END IF;
  UPDATE public.raffles SET activa = _active WHERE id = _raffle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'raffle_not_found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_active_raffle(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_raffle(uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  PERFORM pg_advisory_xact_lock(731948);
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid AND role = 'admin') THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN RETURN false; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (uid, 'admin') ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.bootstrap_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin_setup_pending()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin');
$$;
REVOKE ALL ON FUNCTION public.is_admin_setup_pending() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_setup_pending() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.register_draw(
  _raffle_id uuid, _mayor integer, _seco1 integer, _seco2 integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.raffles%ROWTYPE; modulus integer; matches jsonb; winners jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
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
  INSERT INTO public.draws(raffle_id, premio_mayor_num, seco1_num, seco2_num, ganadores)
  VALUES (_raffle_id, _mayor, _seco1, _seco2, winners)
  ON CONFLICT (raffle_id) DO UPDATE SET premio_mayor_num=excluded.premio_mayor_num,
    seco1_num=excluded.seco1_num, seco2_num=excluded.seco2_num, ganadores=excluded.ganadores;
  RETURN winners;
END;
$$;
REVOKE ALL ON FUNCTION public.register_draw(uuid, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_draw(uuid, integer, integer, integer) TO authenticated, service_role;
