ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS referencia_pago text,
  ADD COLUMN IF NOT EXISTS monto_recibido integer,
  ADD COLUMN IF NOT EXISTS validado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validado_at timestamptz;