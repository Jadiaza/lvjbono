-- Los lotes se pueden preparar y equilibrar antes de asignar un responsable.
ALTER TABLE public.raffle_bono_batches
  ALTER COLUMN responsible_id DROP NOT NULL;
