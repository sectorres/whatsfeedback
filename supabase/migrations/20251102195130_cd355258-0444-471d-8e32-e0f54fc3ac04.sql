-- Create public bucket for WhatsApp media (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to media files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read whatsapp-media'
  ) THEN
    CREATE POLICY "Public read whatsapp-media"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'whatsapp-media');
  END IF;
END $$;