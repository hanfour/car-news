-- Fix infinite recursion in profiles RLS policy
-- The problem: policy queries profiles table while being evaluated on profiles table

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view admin status" ON profiles;

-- Create a new policy that doesn't cause recursion
-- We keep the existing "Profiles are viewable by everyone" policy which allows all SELECTs
-- This is safe because profiles don't contain sensitive data except is_admin

-- For UPDATE and INSERT, we still restrict to own profile
-- The is_admin field will be managed through service role key only

-- Add comment to document the decision
COMMENT ON TABLE profiles IS 'All profiles are publicly viewable (read-only). Updates restricted to own profile. is_admin field managed via service role only.';
