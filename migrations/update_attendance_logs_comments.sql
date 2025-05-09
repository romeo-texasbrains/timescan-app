-- Migration to add comments to attendance_logs table to document overnight shift handling
COMMENT ON TABLE attendance_logs IS 'Stores attendance events (signin, signout, break_start, break_end). For overnight shifts, a single shift is represented by a signin event and a signout event, even if they occur on different calendar days. Shifts are attributed to the date of the signin event for reporting purposes.';

COMMENT ON COLUMN attendance_logs.timestamp IS 'The date and time when the attendance event occurred. For overnight shifts, the signin and signout timestamps will be on different calendar days.';

COMMENT ON COLUMN attendance_logs.event_type IS 'The type of attendance event: signin, signout, break_start, or break_end. For overnight shifts, a signin event is paired with the next chronological signout event for the same user, regardless of calendar day.';
