-- Expand public appearance options while preserving previous selections.
ALTER TABLE public.raffles
  DROP CONSTRAINT IF EXISTS raffles_public_skin_check;

UPDATE public.raffles
SET public_skin = CASE public_skin
  WHEN 'carton-fiesta' THEN 'purpura-real'
  WHEN 'elegante' THEN 'verde-esmeralda'
  WHEN 'noche-premium' THEN 'oscuro-moderno'
  ELSE public_skin
END;

ALTER TABLE public.raffles
  ALTER COLUMN public_skin SET DEFAULT 'purpura-real';

ALTER TABLE public.raffles
  ADD CONSTRAINT raffles_public_skin_check
  CHECK (public_skin IN (
    'verde-esmeralda',
    'azul-profundo',
    'purpura-real',
    'naranja-energia',
    'rojo-pasion',
    'dorado-premium',
    'turquesa-marino',
    'oscuro-moderno'
  ));

