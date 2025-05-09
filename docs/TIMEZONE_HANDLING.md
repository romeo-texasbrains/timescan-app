# Timezone Handling in TimeScan

## Overview

TimeScan now properly handles timezones throughout the application. This document explains how timezones are implemented and how they affect the display of dates and times.

## Database Schema

The application stores all timestamps in UTC in the database, which is the standard practice for storing time data. The timezone setting is stored in the `app_settings` table:

```sql
-- app_settings table
CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY,
  company_name TEXT,
  default_hours NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  timezone TEXT DEFAULT 'UTC'
);
```

The `timezone` column stores the IANA timezone name (e.g., "America/New_York", "Asia/Karachi") that is used for displaying dates and times throughout the application.

## Timezone-Aware Formatting

The application uses the `date-fns-tz` library to format dates and times in the specified timezone. The key function used is `formatInTimeZone`:

```javascript
import { formatInTimeZone } from 'date-fns-tz';

// Format a date in the specified timezone
const formattedDate = formatInTimeZone(
  date,           // Date object or ISO string
  timezone,       // IANA timezone name (e.g., "America/New_York")
  'yyyy-MM-dd'    // Format string
);
```

## Implementation Details

Timezone handling is implemented in the following components:

1. **Admin Reports Page** (`app/(app)/admin/reports/page.tsx`):
   - Fetches the timezone setting from the `app_settings` table
   - Uses `formatInTimeZone` to format dates and times in the specified timezone
   - Displays the timezone in the date headers

2. **Manager Reports Page** (`app/(app)/mgmt/reports/page.tsx`):
   - Fetches the timezone setting from the `app_settings` table
   - Uses `formatInTimeZone` to format dates and times in the specified timezone
   - Displays the timezone in the date headers

3. **History Page** (`app/(app)/history/page.tsx`):
   - Fetches the timezone setting from the `app_settings` table
   - Uses `formatInTimeZone` to format timestamps in the specified timezone
   - Displays the timezone in the page header

## Date Grouping

When grouping logs by date (e.g., for reports), the application uses the timezone-aware date:

```javascript
// Helper function to format date in the specified timezone
const formatDateInTimezone = (date: Date): string => {
  try {
    return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
  } catch (error) {
    console.error("Error formatting date in timezone:", error);
    return format(date, 'yyyy-MM-dd'); // Fallback to UTC
  }
};

// Use the timezone-aware date for grouping
const reportDate = formatDateInTimezone(timestamp);
```

This ensures that logs are grouped correctly according to the specified timezone, even if the timestamp crosses midnight in UTC.

## Overnight Shifts

For overnight shifts (shifts that start on one day and end on the next), the application attributes the shift to the date of the signin event in the specified timezone. This ensures that reports are consistent and accurate, regardless of the timezone setting.

## Changing the Timezone

The timezone setting can be changed by an admin user in the application settings. When the timezone is changed, all dates and times will be displayed in the new timezone, including historical data.

## Testing Timezone Handling

To test timezone handling:

1. Set the timezone in the `app_settings` table to a different timezone (e.g., "America/New_York", "Asia/Karachi")
2. Verify that all dates and times are displayed correctly in the specified timezone
3. Verify that overnight shifts are attributed to the correct date
4. Verify that reports group data correctly by date in the specified timezone
