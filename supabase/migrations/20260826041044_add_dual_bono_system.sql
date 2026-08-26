-- Bono personalizado en duplas. This migration is intentionally additive and
-- does not alter previously applied migrations or existing standard raffle data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.raffles
  ADD COLUMN IF NOT EXISTS raffle_mode text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS bono_total integer,
  ADD COLUMN IF NOT EXISTS bono_numbers_per_ticket smallint,
  ADD COLUMN IF NOT EXISTS bono_title text,
  ADD COLUMN IF NOT EXISTS bono_subtitle text,
  ADD COLUMN IF NOT EXISTS bono_prize_name text,
  ADD COLUMN IF NOT EXISTS bono_prize_description text,
  ADD COLUMN IF NOT EXISTS bono_prize_dimensions text,
  ADD COLUMN IF NOT EXISTS bono_prize_image_url text,
  ADD COLUMN IF NOT EXISTS bono_side_image_url text,
  ADD COLUMN IF NOT EXISTS bono_logo_url text,
  ADD COLUMN IF NOT EXISTS bono_number_color text NOT NULL DEFAULT '#C51B1B',
  ADD COLUMN IF NOT EXISTS bono_accent_color text NOT NULL DEFAULT '#C51B1B',
  ADD COLUMN IF NOT EXISTS bono_footer_text text NOT NULL DEFAULT '¡Gracias por apoyar nuestra misión!',
  ADD COLUMN IF NOT EXISTS bono_show_qr boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bono_show_platform_branding boolean NOT NULL DEFAULT true;

ALTER TABLE public.raffles DROP CONSTRAINT IF EXISTS raffles_raffle_mode_check;
ALTER TABLE public.raffles ADD CONSTRAINT raffles_raffle_mode_check
  CHECK (raffle_mode IN ('standard', 'dual_bono'));
ALTER TABLE public.raffles DROP CONSTRAINT IF EXISTS raffles_bono_configuration_check;
ALTER TABLE public.raffles ADD CONSTRAINT raffles_bono_configuration_check CHECK (
  raffle_mode = 'standard' OR (
    digitos = 3 AND bono_numbers_per_ticket = 2
    AND bono_total BETWEEN 1 AND 500
    AND bono_total * bono_numbers_per_ticket <= 1000
  )
);

CREATE TABLE IF NOT EXISTS public.raffle_responsibles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  username text NOT NULL,
  display_name text NOT NULL,
  phone text,
  email text,
  slug text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  public_page_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT raffle_responsibles_username_format CHECK (username ~ '^[a-z0-9._-]{3,40}$'),
  CONSTRAINT raffle_responsibles_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
CREATE UNIQUE INDEX IF NOT EXISTS raffle_responsibles_username_unique
  ON public.raffle_responsibles (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS raffle_responsibles_slug_unique
  ON public.raffle_responsibles (lower(slug));

CREATE TABLE IF NOT EXISTS public.raffle_bono_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  responsible_id uuid NOT NULL REFERENCES public.raffle_responsibles(id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'cerrado', 'devuelto')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  returned_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (raffle_id, code)
);

CREATE TABLE IF NOT EXISTS public.raffle_bono_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.raffles(id) ON DELETE RESTRICT,
  responsible_id uuid REFERENCES public.raffle_responsibles(id) ON DELETE RESTRICT,
  buyer_name text NOT NULL,
  buyer_phone text NOT NULL,
  buyer_city text,
  buyer_notes text,
  total_value integer NOT NULL CHECK (total_value >= 0),
  amount_paid integer NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  payment_reference text,
  sold_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (amount_paid <= total_value)
);

CREATE TABLE IF NOT EXISTS public.raffle_bonos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  serial integer NOT NULL CHECK (serial BETWEEN 1 AND 500),
  verification_code uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'disponible' CHECK (
    status IN ('disponible', 'asignado', 'reservado', 'vendido', 'pagado', 'devuelto', 'anulado')
  ),
  current_responsible_id uuid REFERENCES public.raffle_responsibles(id) ON DELETE RESTRICT,
  current_batch_id uuid REFERENCES public.raffle_bono_batches(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES public.raffle_bono_sales(id) ON DELETE SET NULL,
  buyer_name text,
  buyer_phone text,
  buyer_city text,
  buyer_notes text,
  sale_value integer CHECK (sale_value IS NULL OR sale_value >= 0),
  amount_paid integer NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  payment_reference text,
  reserved_at timestamptz,
  reservation_expires_at timestamptz,
  sold_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (raffle_id, serial),
  UNIQUE (verification_code)
);

CREATE TABLE IF NOT EXISTS public.raffle_bono_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  bono_id uuid NOT NULL REFERENCES public.raffle_bonos(id) ON DELETE CASCADE,
  option_number smallint NOT NULL CHECK (option_number IN (1, 2)),
  numero smallint NOT NULL CHECK (numero BETWEEN 0 AND 999),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bono_id, option_number),
  UNIQUE (raffle_id, numero)
);

CREATE TABLE IF NOT EXISTS public.raffle_bono_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  bono_id uuid NOT NULL REFERENCES public.raffle_bonos(id) ON DELETE CASCADE,
  responsible_id uuid NOT NULL REFERENCES public.raffle_responsibles(id) ON DELETE RESTRICT,
  batch_id uuid REFERENCES public.raffle_bono_batches(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  end_reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS raffle_bono_assignments_one_active
  ON public.raffle_bono_assignments (bono_id) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS public.raffle_bono_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  bono_id uuid REFERENCES public.raffle_bonos(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responsible_id uuid REFERENCES public.raffle_responsibles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS raffle_bonos_raffle_status_idx ON public.raffle_bonos (raffle_id, status);
CREATE INDEX IF NOT EXISTS raffle_bonos_responsible_idx ON public.raffle_bonos (current_responsible_id, status);
CREATE INDEX IF NOT EXISTS raffle_bono_numbers_bono_idx ON public.raffle_bono_numbers (bono_id);
CREATE INDEX IF NOT EXISTS raffle_bono_batches_responsible_idx ON public.raffle_bono_batches (responsible_id);
CREATE INDEX IF NOT EXISTS raffle_bono_events_bono_created_idx ON public.raffle_bono_events (bono_id, created_at DESC);

-- Standard raffles keep their existing ticket seeding behaviour. Dual bonos
-- are generated only through generate_dual_bonos below.
CREATE OR REPLACE FUNCTION public.seed_raffle_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.raffle_mode = 'standard' THEN
    IF NEW.digitos NOT IN (2, 3) THEN
      RAISE EXCEPTION 'digitos must be 2 or 3';
    END IF;
    INSERT INTO public.tickets (raffle_id, numero)
    SELECT NEW.id, n
    FROM generate_series(0, power(10, NEW.digitos)::integer - 1) AS n
    ON CONFLICT (raffle_id, numero) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_dual_bonos(_raffle_id uuid, _total_bonos integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  campaign public.raffles%ROWTYPE;
  generated_count integer;
BEGIN
  SELECT * INTO campaign FROM public.raffles WHERE id = _raffle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'raffle_not_found'; END IF;
  IF campaign.raffle_mode <> 'dual_bono' OR campaign.digitos <> 3 THEN
    RAISE EXCEPTION 'invalid_dual_bono_campaign';
  END IF;
  IF _total_bonos < 1 OR _total_bonos > 500 OR _total_bonos * 2 > 1000 THEN
    RAISE EXCEPTION 'invalid_bono_total';
  END IF;
  IF EXISTS (SELECT 1 FROM public.raffle_bonos WHERE raffle_id = _raffle_id) THEN
    RAISE EXCEPTION 'bonos_already_generated';
  END IF;

  WITH inserted AS (
    INSERT INTO public.raffle_bonos (raffle_id, serial, sale_value)
    SELECT _raffle_id, n, campaign.valor_boleta
    FROM generate_series(1, _total_bonos) AS n
    RETURNING id, serial
  ), shuffled AS (
    SELECT n, row_number() OVER (ORDER BY gen_random_bytes(16)) AS position
    FROM generate_series(0, 999) AS n
  )
  INSERT INTO public.raffle_bono_numbers (raffle_id, bono_id, option_number, numero)
  SELECT _raffle_id, i.id, ((s.position - 1) % 2 + 1)::smallint, s.n::smallint
  FROM shuffled s
  JOIN inserted i ON i.serial = ((s.position - 1) / 2) + 1
  WHERE s.position <= _total_bonos * 2;

  INSERT INTO public.raffle_bono_events (raffle_id, bono_id, event_type, to_status)
  SELECT _raffle_id, id, 'generado', 'disponible'
  FROM public.raffle_bonos WHERE raffle_id = _raffle_id;

  SELECT count(*) INTO generated_count FROM public.raffle_bonos WHERE raffle_id = _raffle_id;
  RETURN generated_count;
END;
$$;
REVOKE ALL ON FUNCTION public.generate_dual_bonos(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_dual_bonos(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.touch_dual_bono_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS raffle_bonos_touch_updated_at ON public.raffle_bonos;
CREATE TRIGGER raffle_bonos_touch_updated_at BEFORE UPDATE ON public.raffle_bonos
FOR EACH ROW EXECUTE FUNCTION public.touch_dual_bono_updated_at();
DROP TRIGGER IF EXISTS raffle_responsibles_touch_updated_at ON public.raffle_responsibles;
CREATE TRIGGER raffle_responsibles_touch_updated_at BEFORE UPDATE ON public.raffle_responsibles
FOR EACH ROW EXECUTE FUNCTION public.touch_dual_bono_updated_at();

ALTER TABLE public.raffle_responsibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffle_bono_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffle_bono_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffle_bonos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffle_bono_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffle_bono_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffle_bono_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.raffle_responsibles, public.raffle_bono_batches,
  public.raffle_bono_sales, public.raffle_bonos, public.raffle_bono_numbers,
  public.raffle_bono_assignments, public.raffle_bono_events FROM anon, authenticated;
GRANT SELECT ON TABLE public.raffle_responsibles, public.raffle_bono_batches,
  public.raffle_bonos, public.raffle_bono_numbers TO authenticated;

DROP POLICY IF EXISTS "responsible reads own profile" ON public.raffle_responsibles;
CREATE POLICY "responsible reads own profile" ON public.raffle_responsibles FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL AND auth_user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "responsible reads own batches" ON public.raffle_bono_batches;
CREATE POLICY "responsible reads own batches" ON public.raffle_bono_batches FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.raffle_responsibles rr
  WHERE rr.id = responsible_id AND rr.auth_user_id = (SELECT auth.uid()) AND rr.active));
DROP POLICY IF EXISTS "responsible reads own bonos" ON public.raffle_bonos;
CREATE POLICY "responsible reads own bonos" ON public.raffle_bonos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.raffle_responsibles rr
  WHERE rr.id = current_responsible_id AND rr.auth_user_id = (SELECT auth.uid()) AND rr.active));
DROP POLICY IF EXISTS "responsible reads own bono numbers" ON public.raffle_bono_numbers;
CREATE POLICY "responsible reads own bono numbers" ON public.raffle_bono_numbers FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.raffle_bonos rb JOIN public.raffle_responsibles rr
  ON rr.id = rb.current_responsible_id
  WHERE rb.id = bono_id AND rr.auth_user_id = (SELECT auth.uid()) AND rr.active));

-- No client role receives INSERT/UPDATE/DELETE. All mutations pass through
-- authenticated server functions, which derive actor and ownership server-side.
