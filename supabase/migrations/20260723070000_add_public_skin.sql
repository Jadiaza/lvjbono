-- Public visual identity selected per raffle. Admin UI remains unchanged.
ALTER TABLE public.raffles
  ADD COLUMN IF NOT EXISTS public_skin text NOT NULL DEFAULT 'carton-fiesta';

ALTER TABLE public.raffles
  DROP CONSTRAINT IF EXISTS raffles_public_skin_check;

ALTER TABLE public.raffles
  ADD CONSTRAINT raffles_public_skin_check
  CHECK (public_skin IN ('carton-fiesta', 'elegante', 'noche-premium'));

