-- Test script for adherence functions
-- Run this script to test the adherence functions

-- Setup test environment
DO $$
DECLARE
  test_user_id UUID;
  test_admin_id UUID;
  test_dept_id UUID;
BEGIN
  -- Use existing users for testing
  SELECT id INTO test_user_id FROM profiles WHERE role = 'employee' LIMIT 1;
  SELECT id INTO test_admin_id FROM profiles WHERE role = 'admin' LIMIT 1;

  -- Create test department
  -- First check if the department exists
  SELECT id INTO test_dept_id FROM departments WHERE name = 'Test Department';

  IF test_dept_id IS NULL THEN
    -- Create new department
    INSERT INTO departments (name, shift_start_time, shift_end_time, grace_period_minutes)
    VALUES ('Test Department', '09:00:00', '17:00:00', 30)
    RETURNING id INTO test_dept_id;
  ELSE
    -- Update existing department
    UPDATE departments
    SET shift_start_time = '09:00:00',
        shift_end_time = '17:00:00',
        grace_period_minutes = 30
    WHERE id = test_dept_id;
  END IF;

  -- Update test user's department
  UPDATE profiles
  SET department_id = test_dept_id
  WHERE id = test_user_id;

  -- Clean up any existing test data
  DELETE FROM attendance_logs WHERE user_id = test_user_id AND timestamp::DATE = CURRENT_DATE;
  DELETE FROM attendance_adherence WHERE user_id = test_user_id AND date = CURRENT_DATE;

  RAISE NOTICE 'Test user ID: %', test_user_id;
  RAISE NOTICE 'Test admin ID: %', test_admin_id;
  RAISE NOTICE 'Test department ID: %', test_dept_id;
END;
$$;

-- Test 1: Early arrival
DO $$
DECLARE
  test_user_id UUID;
  test_date DATE := CURRENT_DATE;
  early_time TIMESTAMP WITH TIME ZONE;
  result_status adherence_status;
BEGIN
  -- Get test user
  SELECT id INTO test_user_id FROM profiles WHERE role = 'employee' LIMIT 1;
  -- Create early signin (30 minutes before shift start)
  early_time := (test_date || ' 08:30:00')::TIMESTAMP WITH TIME ZONE;

  -- Insert early signin
  INSERT INTO attendance_logs (user_id, event_type, timestamp)
  VALUES (test_user_id, 'signin', early_time);

  -- Check adherence status
  SELECT status INTO result_status
  FROM attendance_adherence
  WHERE user_id = test_user_id AND date = test_date;

  -- Verify result
  IF result_status = 'early' THEN
    RAISE NOTICE 'Test 1 (Early arrival): PASSED - Status is %', result_status;
  ELSE
    RAISE NOTICE 'Test 1 (Early arrival): FAILED - Expected "early", got "%"', result_status;
  END IF;

  -- Clean up
  DELETE FROM attendance_logs WHERE user_id = test_user_id;
  DELETE FROM attendance_adherence WHERE user_id = test_user_id;
END;
$$;

-- Test 2: On-time arrival
DO $$
DECLARE
  test_user_id UUID;
  test_date DATE := CURRENT_DATE;
  ontime_time TIMESTAMP WITH TIME ZONE;
  result_status adherence_status;
BEGIN
  -- Get test user
  SELECT id INTO test_user_id FROM profiles WHERE role = 'employee' LIMIT 1;
  -- Create on-time signin (exactly at shift start)
  ontime_time := (test_date || ' 09:00:00')::TIMESTAMP WITH TIME ZONE;

  -- Insert on-time signin
  INSERT INTO attendance_logs (user_id, event_type, timestamp)
  VALUES (test_user_id, 'signin', ontime_time);

  -- Check adherence status
  SELECT status INTO result_status
  FROM attendance_adherence
  WHERE user_id = test_user_id AND date = test_date;

  -- Verify result
  IF result_status = 'on_time' THEN
    RAISE NOTICE 'Test 2 (On-time arrival): PASSED - Status is %', result_status;
  ELSE
    RAISE NOTICE 'Test 2 (On-time arrival): FAILED - Expected "on_time", got "%"', result_status;
  END IF;

  -- Clean up
  DELETE FROM attendance_logs WHERE user_id = test_user_id;
  DELETE FROM attendance_adherence WHERE user_id = test_user_id;
END;
$$;

-- Test 3: Late arrival (within grace period)
DO $$
DECLARE
  test_user_id UUID;
  test_date DATE := CURRENT_DATE;
  late_time TIMESTAMP WITH TIME ZONE;
  result_status adherence_status;
BEGIN
  -- Get test user
  SELECT id INTO test_user_id FROM profiles WHERE role = 'employee' LIMIT 1;
  -- Create late signin (15 minutes after shift start, within grace period)
  late_time := (test_date || ' 09:15:00')::TIMESTAMP WITH TIME ZONE;

  -- Insert late signin
  INSERT INTO attendance_logs (user_id, event_type, timestamp)
  VALUES (test_user_id, 'signin', late_time);

  -- Check adherence status
  SELECT status INTO result_status
  FROM attendance_adherence
  WHERE user_id = test_user_id AND date = test_date;

  -- Verify result
  IF result_status = 'on_time' THEN
    RAISE NOTICE 'Test 3 (Late within grace period): PASSED - Status is %', result_status;
  ELSE
    RAISE NOTICE 'Test 3 (Late within grace period): FAILED - Expected "on_time", got "%"', result_status;
  END IF;

  -- Clean up
  DELETE FROM attendance_logs WHERE user_id = test_user_id;
  DELETE FROM attendance_adherence WHERE user_id = test_user_id;
END;
$$;

-- Test 4: Late arrival (outside grace period)
DO $$
DECLARE
  test_user_id UUID;
  test_date DATE := CURRENT_DATE;
  late_time TIMESTAMP WITH TIME ZONE;
  result_status adherence_status;
BEGIN
  -- Get test user
  SELECT id INTO test_user_id FROM profiles WHERE role = 'employee' LIMIT 1;
  -- Create late signin (45 minutes after shift start, outside grace period)
  late_time := (test_date || ' 09:45:00')::TIMESTAMP WITH TIME ZONE;

  -- Insert late signin
  INSERT INTO attendance_logs (user_id, event_type, timestamp)
  VALUES (test_user_id, 'signin', late_time);

  -- Check adherence status
  SELECT status INTO result_status
  FROM attendance_adherence
  WHERE user_id = test_user_id AND date = test_date;

  -- Verify result
  IF result_status = 'late' THEN
    RAISE NOTICE 'Test 4 (Late outside grace period): PASSED - Status is %', result_status;
  ELSE
    RAISE NOTICE 'Test 4 (Late outside grace period): FAILED - Expected "late", got "%"', result_status;
  END IF;

  -- Clean up
  DELETE FROM attendance_logs WHERE user_id = test_user_id;
  DELETE FROM attendance_adherence WHERE user_id = test_user_id;
END;
$$;

-- Test 5: Absent eligibility
DO $$
DECLARE
  test_user_id UUID;
  test_date DATE := CURRENT_DATE;
  late_time TIMESTAMP WITH TIME ZONE;
  is_eligible BOOLEAN;
BEGIN
  -- Get test user
  SELECT id INTO test_user_id FROM profiles WHERE role = 'employee' LIMIT 1;
  -- Create very late signin (5 hours after shift start)
  late_time := (test_date || ' 14:00:00')::TIMESTAMP WITH TIME ZONE;

  -- Insert late signin
  INSERT INTO attendance_logs (user_id, event_type, timestamp)
  VALUES (test_user_id, 'signin', late_time);

  -- Check absent eligibility
  SELECT check_absent_eligibility(test_user_id, test_date) INTO is_eligible;

  -- Verify result
  IF is_eligible = TRUE THEN
    RAISE NOTICE 'Test 5 (Absent eligibility): PASSED - User is eligible for absent marking';
  ELSE
    RAISE NOTICE 'Test 5 (Absent eligibility): FAILED - Expected TRUE, got FALSE';
  END IF;

  -- Clean up
  DELETE FROM attendance_logs WHERE user_id = test_user_id;
  DELETE FROM attendance_adherence WHERE user_id = test_user_id;
END;
$$;

-- Test 6: Manual absent marking
DO $$
DECLARE
  test_user_id UUID;
  test_admin_id UUID;
  test_date DATE := CURRENT_DATE;
  result_status adherence_status;
BEGIN
  -- Get test user and admin
  SELECT id INTO test_user_id FROM profiles WHERE role = 'employee' LIMIT 1;
  SELECT id INTO test_admin_id FROM profiles WHERE role = 'admin' LIMIT 1;

  -- Mark user as absent
  INSERT INTO attendance_adherence (user_id, date, status, marked_by)
  VALUES (test_user_id, test_date, 'absent', test_admin_id);

  -- Check adherence status
  SELECT status INTO result_status
  FROM attendance_adherence
  WHERE user_id = test_user_id AND date = test_date;

  -- Verify result
  IF result_status = 'absent' THEN
    RAISE NOTICE 'Test 6 (Manual absent marking): PASSED - Status is %', result_status;
  ELSE
    RAISE NOTICE 'Test 6 (Manual absent marking): FAILED - Expected "absent", got "%"', result_status;
  END IF;

  -- Clean up
  DELETE FROM attendance_adherence WHERE user_id = test_user_id;
END;
$$;

-- Test 7: Trigger doesn't override absent status
DO $$
DECLARE
  test_user_id UUID;
  test_admin_id UUID;
  test_date DATE := CURRENT_DATE;
  signin_time TIMESTAMP WITH TIME ZONE;
  result_status adherence_status;
BEGIN
  -- Get test user and admin
  SELECT id INTO test_user_id FROM profiles WHERE role = 'employee' LIMIT 1;
  SELECT id INTO test_admin_id FROM profiles WHERE role = 'admin' LIMIT 1;

  -- Mark user as absent
  INSERT INTO attendance_adherence (user_id, date, status, marked_by)
  VALUES (test_user_id, test_date, 'absent', test_admin_id);

  -- Create late signin
  signin_time := (test_date || ' 10:00:00')::TIMESTAMP WITH TIME ZONE;

  -- Insert late signin
  INSERT INTO attendance_logs (user_id, event_type, timestamp)
  VALUES (test_user_id, 'signin', signin_time);

  -- Check adherence status
  SELECT status INTO result_status
  FROM attendance_adherence
  WHERE user_id = test_user_id AND date = test_date;

  -- Verify result
  IF result_status = 'absent' THEN
    RAISE NOTICE 'Test 7 (Trigger respects absent status): PASSED - Status remained %', result_status;
  ELSE
    RAISE NOTICE 'Test 7 (Trigger respects absent status): FAILED - Expected "absent", got "%"', result_status;
  END IF;

  -- Clean up
  DELETE FROM attendance_logs WHERE user_id = test_user_id;
  DELETE FROM attendance_adherence WHERE user_id = test_user_id;
END;
$$;
