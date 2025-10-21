-- Tag a Long - Storage Configuration
-- Migration 04: Set up file storage buckets and policies
-- Run this fourth in Supabase SQL Editor

-- NOTE: Storage buckets must be created via Supabase Dashboard first!
-- This file contains the policies to apply after bucket creation.

-- ============================================================================
-- STORAGE BUCKETS (Create these in Dashboard first)
-- ============================================================================
-- 1. profile-photos (public)
-- 2. listing-photos (public)

-- ============================================================================
-- STORAGE POLICIES: profile-photos
-- ============================================================================

-- Anyone can view profile photos (public bucket)
CREATE POLICY "Profile photos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

-- Authenticated users can upload to their own folder
CREATE POLICY "Users can upload own profile photo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own profile photos
CREATE POLICY "Users can update own profile photo"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'profile-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own profile photos
CREATE POLICY "Users can delete own profile photo"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'profile-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- STORAGE POLICIES: listing-photos
-- ============================================================================

-- Anyone can view listing photos (public bucket)
CREATE POLICY "Listing photos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listing-photos');

-- Authenticated users can upload to their own folder
CREATE POLICY "Users can upload own listing photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'listing-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own listing photos
CREATE POLICY "Users can update own listing photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'listing-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own listing photos
CREATE POLICY "Users can delete own listing photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'listing-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- HELPER FUNCTIONS FOR IMAGE UPLOAD
-- ============================================================================

-- Generate a unique filename for uploads
CREATE OR REPLACE FUNCTION generate_upload_filename(
  original_filename TEXT,
  prefix TEXT DEFAULT ''
)
RETURNS TEXT AS $$
DECLARE
  extension TEXT;
  unique_name TEXT;
BEGIN
  -- Get file extension
  extension := lower(substring(original_filename from '\.([^.]+)$'));

  -- Generate unique filename with timestamp
  unique_name := prefix || extract(epoch from now())::bigint || '_' || gen_random_uuid();

  -- Return with extension
  RETURN unique_name || '.' || extension;
END;
$$ LANGUAGE plpgsql;

-- Get public URL for storage object
-- Note: Replace YOUR_PROJECT_ID with your actual Supabase project ID after deployment
-- Or use this function from your frontend where you have access to the project URL
CREATE OR REPLACE FUNCTION get_storage_url(
  bucket_name TEXT,
  file_path TEXT
)
RETURNS TEXT AS $$
BEGIN
  -- This returns a relative path that works with Supabase client libraries
  -- Frontend should prepend the full Supabase URL
  RETURN '/storage/v1/object/public/' || bucket_name || '/' || file_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alternative: Get full URL if project reference is set
CREATE OR REPLACE FUNCTION get_full_storage_url(
  bucket_name TEXT,
  file_path TEXT,
  project_url TEXT
)
RETURNS TEXT AS $$
BEGIN
  -- Pass project URL from client (e.g., https://xxxxx.supabase.co)
  RETURN project_url || '/storage/v1/object/public/' || bucket_name || '/' || file_path;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CLEANUP OLD UPLOADS
-- ============================================================================
-- Function to clean up unused images

CREATE OR REPLACE FUNCTION cleanup_unused_profile_photos()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete profile photos that are not referenced in profiles table
  DELETE FROM storage.objects
  WHERE bucket_id = 'profile-photos'
  AND name NOT IN (
    SELECT substring(profile_photo_url from '[^/]+$')
    FROM profiles
    WHERE profile_photo_url IS NOT NULL
  )
  AND created_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_unused_listing_photos()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete listing photos from inactive listings older than 30 days
  DELETE FROM storage.objects
  WHERE bucket_id = 'listing-photos'
  AND name IN (
    SELECT substring(photo_url from '[^/]+$')
    FROM listings
    WHERE is_active = false
    AND created_at < NOW() - INTERVAL '30 days'
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STORAGE QUOTAS & LIMITS
-- ============================================================================

-- Check user's storage usage
CREATE OR REPLACE FUNCTION get_user_storage_usage()
RETURNS JSONB AS $$
DECLARE
  profile_size BIGINT;
  listing_size BIGINT;
BEGIN
  -- Get profile photos size
  SELECT COALESCE(SUM(metadata->>'size')::BIGINT, 0)
  INTO profile_size
  FROM storage.objects
  WHERE bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text;

  -- Get listing photos size
  SELECT COALESCE(SUM(metadata->>'size')::BIGINT, 0)
  INTO listing_size
  FROM storage.objects
  WHERE bucket_id = 'listing-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text;

  RETURN jsonb_build_object(
    'profile_photos_bytes', profile_size,
    'listing_photos_bytes', listing_size,
    'total_bytes', profile_size + listing_size,
    'total_mb', ROUND((profile_size + listing_size)::numeric / 1024 / 1024, 2)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- INSTRUCTIONS FOR MANUAL BUCKET CREATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Storage policies created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: You must create storage buckets manually:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Go to Supabase Dashboard → Storage';
  RAISE NOTICE '2. Click "New bucket"';
  RAISE NOTICE '3. Create bucket: profile-photos';
  RAISE NOTICE '   - Name: profile-photos';
  RAISE NOTICE '   - Public: YES';
  RAISE NOTICE '   - File size limit: 5 MB';
  RAISE NOTICE '   - Allowed MIME types: image/jpeg, image/png, image/webp';
  RAISE NOTICE '';
  RAISE NOTICE '4. Create bucket: listing-photos';
  RAISE NOTICE '   - Name: listing-photos';
  RAISE NOTICE '   - Public: YES';
  RAISE NOTICE '   - File size limit: 10 MB';
  RAISE NOTICE '   - Allowed MIME types: image/jpeg, image/png, image/webp';
  RAISE NOTICE '';
  RAISE NOTICE 'After creating buckets, the policies above will automatically apply!';
END $$;
