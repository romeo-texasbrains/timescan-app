-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS admin_read_all_profiles ON profiles;
DROP POLICY IF EXISTS admin_update_all_profiles ON profiles;
DROP POLICY IF EXISTS admin_delete_profiles ON profiles;
DROP POLICY IF EXISTS "Allow admin users read access to all profiles" ON profiles;
DROP POLICY IF EXISTS "Allow admin users to update any profile" ON profiles;
DROP POLICY IF EXISTS "Allow admin users to delete any profile" ON profiles;
DROP POLICY IF EXISTS manager_read_all_profiles ON profiles;
DROP POLICY IF EXISTS manager_read_department_profiles ON profiles;
DROP POLICY IF EXISTS allow_all ON profiles;
DROP POLICY IF EXISTS read_own_profile ON profiles;
DROP POLICY IF EXISTS update_own_profile ON profiles;
DROP POLICY IF EXISTS "Allow authenticated users read access to own profile" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated users to update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile." ON profiles;

-- Create new policies using the user_roles table
-- Allow users to read their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'read_own_profile'
  ) THEN
    EXECUTE 'CREATE POLICY read_own_profile ON profiles
      FOR SELECT
      TO authenticated
      USING (auth.uid() = id)';
  ELSE
    -- Update the existing policy
    EXECUTE 'ALTER POLICY read_own_profile ON profiles
      USING (auth.uid() = id)';
  END IF;
END
$$;

-- Allow users to update their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'update_own_profile'
  ) THEN
    EXECUTE 'CREATE POLICY update_own_profile ON profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)';
  ELSE
    -- Update the existing policy
    EXECUTE 'ALTER POLICY update_own_profile ON profiles
      USING (auth.uid() = id)';
  END IF;
END
$$;

-- Allow admins to read all profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'admin_read_all_profiles'
  ) THEN
    EXECUTE 'CREATE POLICY admin_read_all_profiles ON profiles
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid() AND role = ''admin''
        )
      )';
  ELSE
    -- Update the existing policy
    EXECUTE 'ALTER POLICY admin_read_all_profiles ON profiles
      USING (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid() AND role = ''admin''
        )
      )';
  END IF;
END
$$;

-- Allow admins to update all profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'admin_update_all_profiles'
  ) THEN
    EXECUTE 'CREATE POLICY admin_update_all_profiles ON profiles
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid() AND role = ''admin''
        )
      )';
  ELSE
    -- Update the existing policy
    EXECUTE 'ALTER POLICY admin_update_all_profiles ON profiles
      USING (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid() AND role = ''admin''
        )
      )';
  END IF;
END
$$;

-- Allow admins to delete profiles (only create if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'admin_delete_profiles'
  ) THEN
    EXECUTE 'CREATE POLICY admin_delete_profiles ON profiles
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid() AND role = ''admin''
        )
      )';
  ELSE
    -- Update the existing policy
    EXECUTE 'ALTER POLICY admin_delete_profiles ON profiles
      USING (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid() AND role = ''admin''
        )
      )';
  END IF;
END
$$;

-- Allow managers to read all profiles in their department
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'manager_read_department_profiles'
  ) THEN
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
  ELSE
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
  END IF;
END
$$;
