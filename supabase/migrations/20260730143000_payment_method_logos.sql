-- Built-in payment logos and the logo selected by each raffle organizer.
CREATE TABLE IF NOT EXISTS public.payment_method_assets (
  method text PRIMARY KEY CHECK (method IN ('nequi', 'daviplata', 'bre_b', 'mercadopago')),
  display_name text NOT NULL,
  logo_url text NOT NULL
);

INSERT INTO public.payment_method_assets (method, display_name, logo_url) VALUES
  ('nequi', 'Nequi', '/payment-logos/nequi.png'),
  ('daviplata', 'Daviplata', '/payment-logos/daviplata.png'),
  ('bre_b', 'Bre-B', '/payment-logos/bre-b.png'),
  ('mercadopago', 'Mercado Pago', '/payment-logos/mercado-pago.png')
ON CONFLICT (method) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  logo_url = EXCLUDED.logo_url;

ALTER TABLE public.payment_method_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public reads payment method assets" ON public.payment_method_assets;
CREATE POLICY "Public reads payment method assets"
  ON public.payment_method_assets FOR SELECT TO public USING (true);

ALTER TABLE public.raffles
  ADD COLUMN IF NOT EXISTS nequi_logo_url text,
  ADD COLUMN IF NOT EXISTS daviplata_logo_url text,
  ADD COLUMN IF NOT EXISTS bre_b_logo_url text,
  ADD COLUMN IF NOT EXISTS mercadopago_logo_url text;
