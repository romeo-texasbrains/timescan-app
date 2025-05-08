-- Migration to add break_start and break_end to attendance_event_type enum
ALTER TYPE attendance_event_type ADD VALUE IF NOT EXISTS 'break_start';
ALTER TYPE attendance_event_type ADD VALUE IF NOT EXISTS 'break_end';
