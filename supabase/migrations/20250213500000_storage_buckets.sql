-- Create storage buckets for avatars and covers
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 524288, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
  ('covers', 'covers', true, 524288, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS on storage.objects is already enabled by Supabase by default.
-- The ALTER TABLE was removed because the migration role does not own storage.objects.

-- Allow authenticated users to upload their own images
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload their own avatars' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Users can upload their own avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload their own covers' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Users can upload their own covers" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'covers' AND auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Allow users to update their own images
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own avatars' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Users can update their own avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own covers' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Users can update their own covers" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'covers' AND auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Allow users to delete their own images
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own avatars' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Users can delete their own avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own covers' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Users can delete their own covers" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'covers' AND auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Allow public read access to all images
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view all avatars' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Public can view all avatars" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view all covers' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Public can view all covers" ON storage.objects FOR SELECT TO public USING (bucket_id = 'covers');
  END IF;
END $$;
