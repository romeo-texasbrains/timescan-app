-- This script inserts test attendance logs for the team members
-- Run this in the Supabase SQL Editor

-- First, let's delete any existing test logs to avoid duplicates
DELETE FROM attendance_logs 
WHERE timestamp >= '2025-05-09T00:00:00.000Z' 
AND timestamp <= '2025-05-09T23:59:59.999Z';

-- Insert test logs for Hamza Qamar (080d75a9-aa99-447f-8f81-dc63804542c6)
INSERT INTO attendance_logs (id, user_id, event_type, timestamp)
VALUES 
  (uuid_generate_v4(), '080d75a9-aa99-447f-8f81-dc63804542c6', 'signin', '2025-05-09T09:00:00.000Z'),
  (uuid_generate_v4(), '080d75a9-aa99-447f-8f81-dc63804542c6', 'break_start', '2025-05-09T12:00:00.000Z'),
  (uuid_generate_v4(), '080d75a9-aa99-447f-8f81-dc63804542c6', 'break_end', '2025-05-09T12:30:00.000Z');

-- Insert test logs for Kainat Malik (1e6d6669-327d-4f60-8b77-9691e9ae2ba6)
INSERT INTO attendance_logs (id, user_id, event_type, timestamp)
VALUES 
  (uuid_generate_v4(), '1e6d6669-327d-4f60-8b77-9691e9ae2ba6', 'signin', '2025-05-09T09:15:00.000Z');

-- Insert test logs for Muhammad Saad (6d67d682-151f-445e-b346-49ff4f977869)
INSERT INTO attendance_logs (id, user_id, event_type, timestamp)
VALUES 
  (uuid_generate_v4(), '6d67d682-151f-445e-b346-49ff4f977869', 'signin', '2025-05-09T09:30:00.000Z');

-- Insert test logs for Musab Ghani (d8319427-71f4-421f-ad7a-9731297308ac)
INSERT INTO attendance_logs (id, user_id, event_type, timestamp)
VALUES 
  (uuid_generate_v4(), 'd8319427-71f4-421f-ad7a-9731297308ac', 'signin', '2025-05-09T10:00:00.000Z'),
  (uuid_generate_v4(), 'd8319427-71f4-421f-ad7a-9731297308ac', 'break_start', '2025-05-09T12:15:00.000Z'),
  (uuid_generate_v4(), 'd8319427-71f4-421f-ad7a-9731297308ac', 'break_end', '2025-05-09T13:00:00.000Z');

-- Insert test logs for Shayan Ismail (4628e47a-eb6a-4a80-9892-7ca6e8f8fd74)
INSERT INTO attendance_logs (id, user_id, event_type, timestamp)
VALUES 
  (uuid_generate_v4(), '4628e47a-eb6a-4a80-9892-7ca6e8f8fd74', 'signin', '2025-05-09T10:15:00.000Z');

-- Insert test logs for Zain Ansari (478b9c69-cb15-452c-9ca5-76c2f627d67d)
INSERT INTO attendance_logs (id, user_id, event_type, timestamp)
VALUES 
  (uuid_generate_v4(), '478b9c69-cb15-452c-9ca5-76c2f627d67d', 'signin', '2025-05-09T08:45:00.000Z'),
  (uuid_generate_v4(), '478b9c69-cb15-452c-9ca5-76c2f627d67d', 'signout', '2025-05-09T17:30:00.000Z');

-- Verify the inserted logs
SELECT user_id, event_type, timestamp 
FROM attendance_logs 
WHERE timestamp >= '2025-05-09T00:00:00.000Z' 
AND timestamp <= '2025-05-09T23:59:59.999Z'
ORDER BY timestamp;
