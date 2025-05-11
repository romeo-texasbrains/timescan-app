-- Add new columns to the profiles table for the user profile feature
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
ADD COLUMN IF NOT EXISTS health_card_url TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

-- Update the RLS policies to allow users to update their own profile fields
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'update_own_profile'
  ) THEN
    -- Update the existing policy
    EXECUTE 'ALTER POLICY update_own_profile ON profiles
      USING (auth.uid() = id)';
  ELSE
    -- Create the policy if it doesn't exist
    EXECUTE 'CREATE POLICY update_own_profile ON profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)';
  END IF;
END
$$;

-- Ensure admins can update all profile fields
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'admin_update_all_profiles'
  ) THEN
    -- Update the existing policy
    EXECUTE 'ALTER POLICY admin_update_all_profiles ON profiles
      USING (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid() AND role = ''admin''
        )
      )';
  ELSE
    -- Create the policy if it doesn't exist
    EXECUTE 'CREATE POLICY admin_update_all_profiles ON profiles
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid() AND role = ''admin''
        )
      )';
  END IF;
END
$$;

-- Ensure managers can view profiles in their department
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'manager_read_department_profiles'
  ) THEN
    -- Update the existing policy
    EXECUTE 'ALTER POLICY manager_read_department_profiles ON profiles
      USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.role = ''manager''
          AND ur.department_id = profiles.department_id
        )
      )';
  ELSE
    -- Create the policy if it doesn't exist
    EXECUTE 'CREATE POLICY manager_read_department_profiles ON profiles
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.role = ''manager''
          AND ur.department_id = profiles.department_id
        )
      )';
  END IF;
END
$$;
