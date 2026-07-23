
-- Add support for multiple cartones (raffle series) with configurable digit count
ALTER TABLE public.raffles
  ADD COLUMN IF NOT EXISTS serie TEXT,
  ADD COLUMN IF NOT EXISTS digitos INTEGER NOT NULL DEFAULT 2 CHECK (digitos BETWEEN 2 AND 3);

-- Update seeder to respect digitos (100 or 1000 numbers)
CREATE OR REPLACE FUNCTION public.seed_raffle_tickets()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  max_num INTEGER;
BEGIN
  max_num := CASE WHEN NEW.digitos = 3 THEN 999 ELSE 99 END;
  INSERT INTO public.tickets (raffle_id, numero)
  SELECT NEW.id, gs FROM generate_series(0, max_num) gs;
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists (older projects may have lost it)
DROP TRIGGER IF EXISTS trg_seed_raffle_tickets ON public.raffles;
CREATE TRIGGER trg_seed_raffle_tickets
  AFTER INSERT ON public.raffles
  FOR EACH ROW EXECUTE FUNCTION public.seed_raffle_tickets();
