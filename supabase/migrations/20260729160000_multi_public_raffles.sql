-- Allow several independently published raffle pages.
DROP INDEX IF EXISTS public.raffles_single_active;

CREATE OR REPLACE FUNCTION public.set_active_raffle(_raffle_id uuid, _active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.raffles SET activa = _active WHERE id = _raffle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'raffle_not_found'; END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS raffles_public_catalog
  ON public.raffles (activa, created_at DESC)
  WHERE slug IS NOT NULL;
