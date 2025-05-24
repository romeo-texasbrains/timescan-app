-- Robust Adherence Tracking System
-- This script creates functions and triggers to automatically update the attendance_adherence table
-- based on attendance logs and department shift settings

-- Create or update the adherence_status enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'adherence_status') THEN
    CREATE TYPE adherence_status AS ENUM ('early', 'on_time', 'late', 'absent', 'pending');
  ELSE
    -- Check if 'pending' value exists in the enum
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum
      WHERE enumtypid = 'adherence_status'::regtype
      AND enumlabel = 'pending'
    ) THEN
      -- Add 'pending' value to the enum
      ALTER TYPE adherence_status ADD VALUE 'pending';
    END IF;
  END IF;
END
$$;

-- Commit the enum changes before using them
COMMIT;

-- Create a helper function to get the application timezone
CREATE OR REPLACE FUNCTION get_app_timezone()
RETURNS TEXT AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  BEGIN
    SELECT value INTO v_timezone FROM app_settings WHERE key = 'timezone';
    IF v_timezone IS NULL THEN
      RETURN 'UTC';
    END IF;
    RETURN v_timezone;
  EXCEPTION
    WHEN OTHERS THEN
      -- If there's any error (like table doesn't exist), use UTC
      RETURN 'UTC';
  END;
END;
$$ LANGUAGE plpgsql;

-- 1. Create or update the calculate_adherence_status function
CREATE OR REPLACE FUNCTION calculate_adherence_status(
  p_user_id UUID,
  p_date DATE
)
RETURNS adherence_status AS $$
DECLARE
  v_department_id UUID;
  v_shift_start_time TIME;
  v_grace_period_minutes INTEGER;
  v_first_signin TIMESTAMP WITH TIME ZONE;
  v_signin_time TIME;
  v_status adherence_status;
  v_grace_end_time TIME;
  v_early_threshold INTERVAL := '15 minutes';
  v_app_timezone TEXT;
BEGIN
  -- Get the application timezone
  v_app_timezone := get_app_timezone();

  -- Get user's department and shift information
  SELECT department_id INTO v_department_id
  FROM profiles
  WHERE id = p_user_id;

  -- Get department shift settings or use defaults
  IF v_department_id IS NULL THEN
    v_shift_start_time := '09:00:00'::TIME;
    v_grace_period_minutes := 30;
  ELSE
    SELECT
      COALESCE(shift_start_time, '09:00:00'::TIME),
      COALESCE(grace_period_minutes, 30)
    INTO
      v_shift_start_time,
      v_grace_period_minutes
    FROM departments
    WHERE id = v_department_id;
  END IF;

  -- Calculate grace period end time
  v_grace_end_time := v_shift_start_time + (v_grace_period_minutes || ' minutes')::INTERVAL;

  -- Find the first signin for the day
  SELECT timestamp INTO v_first_signin
  FROM attendance_logs
  WHERE user_id = p_user_id
    AND event_type = 'signin'
    AND DATE(timestamp AT TIME ZONE v_app_timezone) = p_date
  ORDER BY timestamp
  LIMIT 1;

  -- If no signin, check if marked absent
  IF v_first_signin IS NULL THEN
    -- Check if already marked absent
    SELECT aa.status INTO v_status
    FROM attendance_adherence aa
    WHERE aa.user_id = p_user_id
      AND aa.date = p_date
      AND aa.status = 'absent';

    -- If marked absent, return absent
    IF v_status = 'absent' THEN
      RETURN 'absent';
    END IF;

    -- If current time is past shift start + 4 hours, eligible for absent
    IF CURRENT_TIME > (v_shift_start_time + INTERVAL '4 hours') AND CURRENT_DATE = p_date THEN
      RETURN 'late'; -- Late, eligible for absent marking
    ELSE
      -- If date is in the past and no signin, consider absent
      IF p_date < CURRENT_DATE THEN
        RETURN 'absent';
      -- Otherwise, no status yet for future dates
      ELSE
        -- For future dates, return 'pending' instead of NULL
        RETURN 'pending';
      END IF;
    END IF;
  END IF;

  -- Extract time from timestamp
  v_signin_time := (v_first_signin AT TIME ZONE v_app_timezone)::TIME;

  -- Determine adherence status
  -- Early: More than 15 minutes before shift start
  IF v_signin_time < (v_shift_start_time - v_early_threshold) THEN
    RETURN 'early';
  -- On time: Between 15 minutes before shift start and end of grace period
  ELSIF v_signin_time <= v_grace_end_time THEN
    RETURN 'on_time';
  -- Late: After grace period
  ELSE
    RETURN 'late';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Create or update the check_absent_eligibility function
CREATE OR REPLACE FUNCTION check_absent_eligibility(
  p_user_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_department_id UUID;
  v_shift_start_time TIME;
  v_first_signin TIMESTAMP WITH TIME ZONE;
  v_current_status adherence_status;
  v_app_timezone TEXT;
BEGIN
  -- Get current adherence status
  SELECT aa.status INTO v_current_status
  FROM attendance_adherence aa
  WHERE aa.user_id = p_user_id
    AND aa.date = p_date;

  -- If already marked absent, not eligible
  IF v_current_status = 'absent' THEN
    RETURN FALSE;
  END IF;

  -- Get application timezone
  v_app_timezone := get_app_timezone();

  -- Get user's department
  SELECT department_id INTO v_department_id
  FROM profiles
  WHERE id = p_user_id;

  -- Get shift start time
  IF v_department_id IS NULL THEN
    v_shift_start_time := '09:00:00'::TIME;
  ELSE
    SELECT COALESCE(shift_start_time, '09:00:00'::TIME) INTO v_shift_start_time
    FROM departments
    WHERE id = v_department_id;
  END IF;

  -- Check if there's a signin for the day
  SELECT timestamp INTO v_first_signin
  FROM attendance_logs
  WHERE user_id = p_user_id
    AND event_type = 'signin'
    AND DATE(timestamp AT TIME ZONE v_app_timezone) = p_date
  ORDER BY timestamp
  LIMIT 1;

  -- If there's a signin, not eligible for absent
  IF v_first_signin IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  -- If current date is the same as p_date and it's not yet 4 hours past shift start, not eligible
  IF CURRENT_DATE = p_date AND CURRENT_TIME < (v_shift_start_time + INTERVAL '4 hours') THEN
    RETURN FALSE;
  END IF;

  -- Otherwise, eligible for absent marking
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 3. Create or update the update_adherence_status trigger function
CREATE OR REPLACE FUNCTION update_adherence_status()
RETURNS TRIGGER AS $$
DECLARE
  v_status adherence_status;
  v_date DATE;
  v_app_timezone TEXT;
  v_existing_absent BOOLEAN;
BEGIN
  -- Get application timezone
  v_app_timezone := get_app_timezone();

  -- Get the date from the timestamp
  v_date := (NEW.timestamp AT TIME ZONE v_app_timezone)::DATE;

  -- Only process signin events
  IF NEW.event_type = 'signin' THEN
    -- Calculate adherence status
    v_status := calculate_adherence_status(NEW.user_id, v_date);

    -- Skip if no status determined
    IF v_status IS NULL THEN
      RETURN NEW;
    END IF;

    -- Use a more reliable approach for handling conflicts
    WITH excluded_values AS (
      SELECT
        NEW.user_id AS user_id,
        v_date AS date,
        v_status AS status
    )
    UPDATE attendance_adherence aa
    SET
      status = v_status,
      updated_at = NOW()
    FROM excluded_values ev
    WHERE
      aa.user_id = ev.user_id AND
      aa.date = ev.date AND
      aa.status != 'absent'; -- Don't automatically change from absent

    -- If no rows were updated (either no conflict or status was 'absent'), insert the record
    IF NOT FOUND THEN
      -- Check if there's an existing record with 'absent' status
      v_existing_absent := false;
      SELECT EXISTS (
        SELECT 1 FROM attendance_adherence aa
        WHERE aa.user_id = NEW.user_id AND aa.date = v_date AND aa.status = 'absent'
      ) INTO v_existing_absent;

      -- Only insert if there's no existing 'absent' record
      IF NOT v_existing_absent THEN
        -- Use explicit column names to avoid ambiguity
        INSERT INTO attendance_adherence (user_id, date, status, updated_at)
        VALUES (NEW.user_id, v_date, v_status, NOW());
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create or update the trigger on attendance_logs
DROP TRIGGER IF EXISTS trg_update_adherence_status ON attendance_logs;
CREATE TRIGGER trg_update_adherence_status
AFTER INSERT OR UPDATE ON attendance_logs
FOR EACH ROW
EXECUTE FUNCTION update_adherence_status();

-- 5. Create a function to recalculate adherence for a date range
CREATE OR REPLACE FUNCTION recalculate_adherence(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  user_id UUID,
  date DATE,
  old_status adherence_status,
  new_status adherence_status,
  updated BOOLEAN
) AS $$
DECLARE
  v_record RECORD;
  v_new_status adherence_status;
  v_app_timezone TEXT;
  v_existing_absent BOOLEAN;
BEGIN
  -- Get application timezone
  v_app_timezone := get_app_timezone();

  -- Loop through each day in the range
  FOR v_record IN
    SELECT DISTINCT a.user_id, d.date
    FROM attendance_logs a
    CROSS JOIN (
      SELECT generate_series(p_start_date, p_end_date, '1 day'::INTERVAL)::DATE AS date
    ) d
    WHERE DATE(a.timestamp AT TIME ZONE v_app_timezone) BETWEEN p_start_date AND p_end_date
  LOOP
    -- Get current status
    SELECT aa.status INTO old_status
    FROM attendance_adherence aa
    WHERE aa.user_id = v_record.user_id AND aa.date = v_record.date;

    -- Calculate new status
    v_new_status := calculate_adherence_status(v_record.user_id, v_record.date);
    new_status := v_new_status;

    -- Skip processing if status is NULL
    IF v_new_status IS NULL THEN
      -- Set updated to false and continue to next record
      updated := FALSE;
      user_id := v_record.user_id;
      date := v_record.date;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Update if needed and not absent
    IF old_status IS NULL OR (old_status != v_new_status AND old_status != 'absent') THEN
      -- Use a more reliable approach for handling conflicts
      WITH excluded_values AS (
        SELECT
          v_record.user_id AS user_id,
          v_record.date AS date,
          v_new_status AS status
      )
      UPDATE attendance_adherence aa
      SET
        status = v_new_status,
        updated_at = NOW()
      FROM excluded_values ev
      WHERE
        aa.user_id = ev.user_id AND
        aa.date = ev.date AND
        aa.status != 'absent';

      -- If no rows were updated (either no conflict or status was 'absent'), insert the record
      IF NOT FOUND THEN
        -- Check if there's an existing record with 'absent' status
        v_existing_absent := false;
        SELECT EXISTS (
          SELECT 1 FROM attendance_adherence aa
          WHERE aa.user_id = v_record.user_id AND aa.date = v_record.date AND aa.status = 'absent'
        ) INTO v_existing_absent;

        -- Only insert if there's no existing 'absent' record
        IF NOT v_existing_absent THEN
          -- Use explicit column names to avoid ambiguity
          INSERT INTO attendance_adherence (user_id, date, status, updated_at)
          VALUES (v_record.user_id, v_record.date, v_new_status, NOW());
        END IF;
      END IF;

      updated := TRUE;
    ELSE
      updated := FALSE;
    END IF;

    user_id := v_record.user_id;
    date := v_record.date;

    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 5b. Create a function to recalculate adherence for a specific user
CREATE OR REPLACE FUNCTION recalculate_adherence_for_user(
  p_user_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  user_id UUID,
  date DATE,
  old_status adherence_status,
  new_status adherence_status,
  updated BOOLEAN
) AS $$
DECLARE
  v_date DATE;
  v_new_status adherence_status;
  v_app_timezone TEXT;
  v_existing_absent BOOLEAN;
BEGIN
  -- Get application timezone
  v_app_timezone := get_app_timezone();

  -- Loop through each day in the range
  FOR v_date IN
    SELECT generate_series(p_start_date, p_end_date, '1 day'::INTERVAL)::DATE
  LOOP
    -- Get current status
    SELECT aa.status INTO old_status
    FROM attendance_adherence aa
    WHERE aa.user_id = p_user_id AND aa.date = v_date;

    -- Calculate new status
    v_new_status := calculate_adherence_status(p_user_id, v_date);
    new_status := v_new_status;

    -- Skip processing if status is NULL
    IF v_new_status IS NULL THEN
      -- Set updated to false and continue to next record
      updated := FALSE;
      date := v_date;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Update if needed and not absent
    IF old_status IS NULL OR (old_status != v_new_status AND old_status != 'absent') THEN
      -- Use a more reliable approach for handling conflicts
      WITH excluded_values AS (
        SELECT
          p_user_id AS user_id,
          v_date AS date,
          v_new_status AS status
      )
      UPDATE attendance_adherence aa
      SET
        status = v_new_status,
        updated_at = NOW()
      FROM excluded_values ev
      WHERE
        aa.user_id = ev.user_id AND
        aa.date = ev.date AND
        aa.status != 'absent';

      -- If no rows were updated (either no conflict or status was 'absent'), insert the record
      IF NOT FOUND THEN
        -- Check if there's an existing record with 'absent' status
        v_existing_absent := false;
        SELECT EXISTS (
          SELECT 1 FROM attendance_adherence aa
          WHERE aa.user_id = p_user_id AND aa.date = v_date AND aa.status = 'absent'
        ) INTO v_existing_absent;

        -- Only insert if there's no existing 'absent' record
        IF NOT v_existing_absent THEN
          -- Use explicit column names to avoid ambiguity
          INSERT INTO attendance_adherence (user_id, date, status, updated_at)
          VALUES (p_user_id, v_date, v_new_status, NOW());
        END IF;
      END IF;

      updated := TRUE;
    ELSE
      updated := FALSE;
    END IF;

    user_id := p_user_id;
    date := v_date;

    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 6. Create a daily job to update adherence status for yesterday
CREATE OR REPLACE FUNCTION daily_adherence_update()
RETURNS VOID AS $$
BEGIN
  -- Recalculate adherence for yesterday
  PERFORM recalculate_adherence(CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE - INTERVAL '1 day');
END;
$$ LANGUAGE plpgsql;

-- 7. Ensure app_settings table exists for timezone configuration
DO $$
BEGIN
  -- Check if the app_settings table exists
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'app_settings'
  ) THEN
    -- Create the table if it doesn't exist
    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Insert default timezone
    INSERT INTO app_settings (key, value, description)
    VALUES ('timezone', 'UTC', 'Application timezone for date/time calculations');
  ELSE
    -- Check if the key column exists
    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'app_settings'
      AND column_name = 'key'
    ) THEN
      -- If the table exists but doesn't have the expected structure,
      -- create a temporary table with the correct structure
      CREATE TABLE app_settings_new (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Insert default timezone
      INSERT INTO app_settings_new (key, value, description)
      VALUES ('timezone', 'UTC', 'Application timezone for date/time calculations');

      -- Drop the old table and rename the new one
      DROP TABLE app_settings;
      ALTER TABLE app_settings_new RENAME TO app_settings;
    ELSE
      -- If the table exists with the correct structure, just insert the timezone if it doesn't exist
      INSERT INTO app_settings (key, value, description)
      VALUES ('timezone', 'UTC', 'Application timezone for date/time calculations')
      ON CONFLICT (key) DO NOTHING;
    END IF;
  END IF;
END
$$;

-- 8. Run initial recalculation for the past 30 days
SELECT recalculate_adherence();
