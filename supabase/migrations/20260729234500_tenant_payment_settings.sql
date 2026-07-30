-- Payment configuration belongs to each rented raffle and is managed by its organizer.
ALTER TABLE public.raffles
  ADD COLUMN IF NOT EXISTS nequi_qr_url text,
  ADD COLUMN IF NOT EXISTS daviplata_qr_url text,
  ADD COLUMN IF NOT EXISTS bre_b_qr_url text,
  ADD COLUMN IF NOT EXISTS mercadopago_url text,
  ADD COLUMN IF NOT EXISTS nequi_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nequi_number_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nequi_qr_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS daviplata_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS daviplata_number_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS daviplata_qr_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bre_b_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bre_b_key_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bre_b_qr_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mercadopago_enabled boolean NOT NULL DEFAULT false;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-qr',
  'payment-qr',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public reads payment QR images" ON storage.objects;
CREATE POLICY "Public reads payment QR images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'payment-qr');

DROP POLICY IF EXISTS "Organizers upload own raffle payment QR" ON storage.objects;
CREATE POLICY "Organizers upload own raffle payment QR"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-qr'
    AND public.has_active_raffle_rental(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

DROP POLICY IF EXISTS "Organizers update own raffle payment QR" ON storage.objects;
CREATE POLICY "Organizers update own raffle payment QR"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'payment-qr'
    AND public.has_active_raffle_rental(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  )
  WITH CHECK (
    bucket_id = 'payment-qr'
    AND public.has_active_raffle_rental(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

DROP POLICY IF EXISTS "Organizers delete own raffle payment QR" ON storage.objects;
CREATE POLICY "Organizers delete own raffle payment QR"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'payment-qr'
    AND public.has_active_raffle_rental(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );
