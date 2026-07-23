
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RAFFLES
CREATE TABLE public.raffles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  valor_boleta INTEGER NOT NULL DEFAULT 10000,
  fecha_sorteo DATE,
  loteria TEXT,
  activa BOOLEAN NOT NULL DEFAULT true,
  whatsapp_admin TEXT,
  nequi TEXT,
  daviplata TEXT,
  bre_b TEXT,
  premio_mayor INTEGER NOT NULL DEFAULT 300000,
  premio_seco1 INTEGER NOT NULL DEFAULT 100000,
  premio_seco2 INTEGER NOT NULL DEFAULT 80000,
  premio_aprox_ant INTEGER NOT NULL DEFAULT 10000,
  premio_aprox_pos INTEGER NOT NULL DEFAULT 10000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.raffles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.raffles TO authenticated;
GRANT ALL ON public.raffles TO service_role;
ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active raffles" ON public.raffles
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can modify raffles" ON public.raffles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- TICKETS
CREATE TYPE public.ticket_estado AS ENUM ('disponible','reservado','vendido','ganador');

CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL CHECK (numero >= 0 AND numero <= 99),
  estado ticket_estado NOT NULL DEFAULT 'disponible',
  nombre TEXT,
  telefono TEXT,
  ciudad TEXT,
  email TEXT,
  medio_pago TEXT,
  valor_pagado INTEGER,
  observaciones TEXT,
  codigo_verificacion UUID NOT NULL DEFAULT gen_random_uuid(),
  fecha_compra TIMESTAMPTZ,
  premio_ganado TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (raffle_id, numero)
);

GRANT INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Admins tienen acceso total a tickets
CREATE POLICY "Admins full access tickets" ON public.tickets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Vista pública segura (sin datos personales)
CREATE VIEW public.public_tickets
WITH (security_invoker = true) AS
SELECT id, raffle_id, numero, estado, premio_ganado
FROM public.tickets;

GRANT SELECT ON public.public_tickets TO anon, authenticated;

-- Permitir a anon leer solo columnas seguras via RLS (para la vista con security_invoker)
CREATE POLICY "Anyone reads ticket status" ON public.tickets
  FOR SELECT TO anon, authenticated USING (true);
-- Nota: la vista solo expone columnas seguras; datos personales quedan en tabla base
-- pero anon puede leer columnas de la tabla base tambien. Para proteger:
-- Revocamos SELECT en la tabla base a anon, y permitimos solo la vista.
REVOKE SELECT ON public.tickets FROM anon;
GRANT SELECT ON public.tickets TO authenticated;

-- Ver ticket propio por codigo_verificacion (para pagina boleta publica)
-- Implementado via server function con service_role.

-- DRAWS
CREATE TABLE public.draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  premio_mayor_num INTEGER NOT NULL,
  seco1_num INTEGER NOT NULL,
  seco2_num INTEGER NOT NULL,
  ganadores JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.draws TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.draws TO authenticated;
GRANT ALL ON public.draws TO service_role;
ALTER TABLE public.draws ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view draws" ON public.draws FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage draws" ON public.draws FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER raffles_updated BEFORE UPDATE ON public.raffles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tickets_updated BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Al crear una rifa, generar automáticamente los 100 tickets 00-99
CREATE OR REPLACE FUNCTION public.seed_raffle_tickets()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.tickets (raffle_id, numero)
  SELECT NEW.id, gs FROM generate_series(0, 99) gs;
  RETURN NEW;
END;
$$;

CREATE TRIGGER raffles_seed_tickets AFTER INSERT ON public.raffles
  FOR EACH ROW EXECUTE FUNCTION public.seed_raffle_tickets();

-- Seed inicial: crear la rifa "¡Qué Locura de Rifa!"
INSERT INTO public.raffles (nombre, valor_boleta, loteria, whatsapp_admin, nequi, daviplata, bre_b, activa)
VALUES ('¡Qué Locura de Rifa!', 10000, 'Lotería de Bogotá', '+57 300 000 0000', '300 000 0000', '301 000 0000', '@qelocura', true);
