-- Fix #459: Add folder-based owner verification to storage buckets
-- Pattern: uploads go to {user_id}/filename, RLS checks (storage.foldername(name))[1] = auth.uid()

-- ============================================================
-- 1. avatars bucket — replace permissive policies with folder-based
-- ============================================================
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
-- Keep public read: DROP POLICY IF EXISTS "Public can view all avatars" ON storage.objects;

CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================
-- 2. covers bucket — replace permissive policies with folder-based
-- ============================================================
DROP POLICY IF EXISTS "Users can upload their own covers" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own covers" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own covers" ON storage.objects;

CREATE POLICY "Users can upload their own covers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'covers' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own covers"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'covers' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own covers"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'covers' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================
-- 3. qr-codes bucket — replace permissive policies with folder-based
-- ============================================================
DROP POLICY IF EXISTS "Users can upload their own QR codes" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own QR codes" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own QR codes" ON storage.objects;

CREATE POLICY "Users can upload their own QR codes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'qr-codes' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own QR codes"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'qr-codes' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own QR codes"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'qr-codes' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
