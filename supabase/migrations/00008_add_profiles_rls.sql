-- Enable RLS was already set on profiles, but no policies existed.
-- This migration adds the minimum necessary policies.

-- Authenticated users can read any profile (needed for middleware session check,
-- browser-side profile lookups, and public seller profile views).
CREATE POLICY "profiles_select_authenticated"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can only update their own profile.
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile row.
-- (Service role handles profile creation in callback, but this guards direct inserts.)
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
