# Overnight Shift Implementation

## Overview

The TimeScan application has been updated to properly handle overnight shifts - shifts that start on one calendar day and end on the next. This document explains how overnight shifts are implemented in the system.

## Data Model

Overnight shifts are stored in the database as follows:

1. Each shift is represented by a single pair of records in the `attendance_logs` table:
   - A `signin` event with a full DateTime timestamp
   - A `signout` event with a full DateTime timestamp

2. For overnight shifts, the `signin` and `signout` events will have timestamps on different calendar days.

3. No special flag or indicator is needed to identify an overnight shift - the system automatically detects and handles them based on the timestamps.

## Shift Attribution

For reporting and display purposes, overnight shifts are attributed to the calendar date of the `signin` event. For example:

- If an employee starts their shift on May 9th at 6:00 PM and ends their shift on May 10th at 3:00 AM:
  - The entire 9-hour shift is attributed to May 9th in reports
  - The shift appears in the May 9th section of reports, not May 10th

## Duration Calculation

Shift duration is calculated by simply subtracting the `signin` timestamp from the `signout` timestamp. The system correctly handles this calculation even when the timestamps are on different calendar days.

## Implementation Details

The overnight shift handling is implemented in the following components:

1. **Manager Reports Page** (`app/(app)/mgmt/reports/page.tsx`):
   - Removed the `isSameDay` check when pairing signin/signout events
   - Added tracking of open signin events to properly pair them with signout events
   - Ensured shifts are attributed to the date of the signin event

2. **Admin Reports Page** (`app/(app)/admin/reports/page.tsx`):
   - Updated the `aggregateLogs` function to handle overnight shifts
   - Removed the `isSameDay` check when pairing signin/signout events
   - Ensured shifts are attributed to the date of the signin event

3. **Dashboard Client** (`components/DashboardClient.tsx`):
   - Removed the `isSameDay` check when pairing signin/signout events
   - Ensured proper duration calculation for overnight shifts

4. **Database Comments** (`migrations/update_attendance_logs_comments.sql`):
   - Added comments to the database schema to document the overnight shift handling

## Testing Overnight Shifts

To test overnight shifts:

1. Sign in on one day (e.g., May 9th at 6:00 PM)
2. Sign out on the next day (e.g., May 10th at 3:00 AM)
3. Verify that the shift appears in reports for May 9th
4. Verify that the duration is calculated correctly (9 hours in this example)
5. Verify that the shift does not appear in reports for May 10th

## Limitations

- The current implementation assumes that a shift will not span more than two calendar days. Shifts longer than 24 hours are not explicitly supported.
- Break periods that cross midnight are not explicitly handled in the current implementation.
