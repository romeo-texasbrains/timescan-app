# TimeScan App - Project Overview

## Architecture Summary

This document provides a comprehensive overview of the TimeScan application architecture, focusing on the unified API design, role-based access control, and centralized business logic implementation.

## Core Architectural Principles

### 1. Unified API Design
- **Centralized business logic** in reusable utility modules
- **Role-based data fetching** with appropriate access controls
- **Consistent data structures** across all endpoints
- **Server-side calculations** for real-time accuracy

### 2. Authentication & Authorization
- **Centralized session management** via `lib/auth/session.ts`
- **Role-based access control** (admin, manager, employee)
- **Consistent authorization checks** across all API endpoints

### 3. Data Access Layer
- **Abstracted database queries** in `lib/db/queries.ts`
- **Reusable query functions** with flexible filtering
- **Separation of concerns** between data access and business logic

## API Endpoints Structure

### Dashboard APIs
```
/api/dashboard/data     - Admin & Manager dashboard data
/api/dashboard/user     - Employee personal dashboard data
```

**Features:**
- Role-based employee filtering (admin sees all, manager sees department)
- Real-time attendance metrics calculation
- Adherence status determination
- Timezone-aware time formatting

### Attendance APIs
```
/api/attendance/history - Historical attendance data with filtering
/api/activity/recent    - Recent activity logs with role-based access
```

**Features:**
- Date range filtering
- User-specific filtering (with authorization checks)
- Grouped vs. chronological data views
- Metrics calculation for historical data

### Settings APIs
```
/api/settings          - Unified app settings (timezone, etc.)
/api/settings/timezone - Specialized timezone endpoint (backward compatibility)
```

**Features:**
- Centralized settings management
- Role-based update permissions (admin only)
- Caching for performance optimization
- Timezone validation and formatting

## Business Logic Modules

### Core Utilities (`lib/utils/`)

#### `adherence-calculator.ts`
- **Purpose**: Determines employee adherence status (early, on_time, late, absent)
- **Key Functions**:
  - `determineAdherenceStatus()` - Main adherence calculation
  - `checkAbsentEligibility()` - Determines if employee can be marked absent
- **Used By**: All dashboard APIs, attendance history

#### `metrics-calculator.ts`
- **Purpose**: Calculates work time, break time, and activity status
- **Key Functions**:
  - `calculateUserAttendanceMetrics()` - Main metrics calculation
- **Used By**: Dashboard APIs, attendance history, reports

#### `time-formatter.ts`
- **Purpose**: Consistent time formatting across the application
- **Key Functions**:
  - `formatDuration()` - Converts seconds to "Xh Ym" format
  - `formatTimestamp()` - Timezone-aware timestamp formatting
  - `capShiftDuration()` - Prevents unreasonably long shift durations
- **Used By**: All APIs, client components

#### `timezone-manager.ts`
- **Purpose**: Centralized timezone management with caching
- **Key Functions**:
  - `getAppTimezone()` - Cached timezone retrieval
  - `formatInAppTimezone()` - Format dates in app timezone
  - `TimezoneManager` class - Client-side timezone management
- **Used By**: All time-related operations

#### `api-helpers.ts`
- **Purpose**: Common API utilities for consistent request/response handling
- **Key Functions**:
  - `getSearchParams()` - Safe URL parameter parsing
  - `createErrorResponse()` - Standardized error responses
  - `createSuccessResponse()` - Standardized success responses
- **Used By**: All API endpoints

### Data Access Layer (`lib/db/`)

#### `queries.ts`
- **Purpose**: Abstracted database operations
- **Key Functions**:
  - `getUsers()` - Flexible user fetching with filtering
  - `getDepartments()` - Department data retrieval
  - `getAttendanceLogs()` - Attendance logs with date/user filtering
  - `getManagerAssignedDepartments()` - Manager's department assignments
  - `getAppSettings()` - Application settings retrieval
- **Used By**: All API endpoints

### Authentication Layer (`lib/auth/`)

#### `session.ts`
- **Purpose**: Centralized authentication and authorization
- **Key Functions**:
  - `getAuthenticatedUser()` - Get current user session
  - `requireAuth()` - Require authentication middleware
  - `requireRole()` - Role-based access control middleware
- **Used By**: All API endpoints, protected pages

## Client-Side Architecture

### Dashboard Components

#### Admin Dashboard (`app/(app)/admin/dashboard/`)
- **Features**: View all employees, department-wise filtering, real-time updates
- **API Usage**: `/api/dashboard/data`, `/api/activity/recent`
- **Real-time**: Supabase subscriptions for live updates

#### Manager Dashboard (`app/(app)/manager/dashboard/`)
- **Features**: View department employees, team management, adherence tracking
- **API Usage**: `/api/dashboard/data` (filtered by department), `/api/activity/recent`
- **Real-time**: Supabase subscriptions for team updates

#### Employee Dashboard (`app/(app)/employee/dashboard/`)
- **Features**: Personal metrics, weekly activity chart, recent activity
- **API Usage**: `/api/dashboard/user`, `/api/activity/recent`
- **Real-time**: Supabase subscriptions for personal updates

### Attendance Features

#### Attendance History (`app/(app)/attendance/history/`)
- **Features**: Date range filtering, user filtering (role-based), daily summaries
- **API Usage**: `/api/attendance/history`
- **Views**: Chronological list, daily grouped summaries

#### Recent Activity (`app/(app)/activity/recent/`)
- **Features**: Real-time activity feed, department filtering, user filtering
- **API Usage**: `/api/activity/recent`
- **Access Control**: Role-based data visibility

## Role-Based Access Control

### Admin Role
- **Dashboard**: View all employees across all departments
- **Attendance**: View/manage attendance for all users
- **Settings**: Read and update all application settings
- **Reports**: Access to all historical data and reports

### Manager Role
- **Dashboard**: View employees in assigned departments only
- **Attendance**: View/manage attendance for department employees
- **Settings**: Read-only access to settings
- **Reports**: Access to department-specific historical data

### Employee Role
- **Dashboard**: View personal metrics and activity only
- **Attendance**: View personal attendance history only
- **Settings**: Read-only access to public settings (timezone)
- **Reports**: Access to personal historical data only

## Real-Time Features

### Supabase Integration
- **Real-time subscriptions** for attendance_logs and attendance_adherence tables
- **Automatic dashboard updates** when attendance events occur
- **Toast notifications** for status changes
- **Fallback polling** every 3 minutes for reliability

### Caching Strategy
- **Timezone caching** (5-minute TTL) to reduce database calls
- **Settings caching** for frequently accessed configuration
- **Client-side caching** with cache invalidation on updates

## Data Flow Examples

### Employee Clock-In Flow
1. Employee scans QR code or uses manual clock-in
2. Attendance log created in Supabase
3. Real-time subscription triggers dashboard updates
4. Adherence status calculated using `adherence-calculator.ts`
5. Metrics updated using `metrics-calculator.ts`
6. All dashboards reflect new status immediately

### Manager Viewing Team Status
1. Manager accesses dashboard
2. `requireRole(['manager'])` validates access
3. `getManagerAssignedDepartments()` gets manager's departments
4. `getUsers()` fetches employees in those departments
5. Metrics calculated for each employee
6. Real-time subscriptions maintain live updates

### Admin Updating Timezone
1. Admin accesses settings
2. `requireRole(['admin'])` validates admin access
3. Timezone validation using `isValidTimezone()`
4. Database updated via `/api/settings/timezone`
5. Cache cleared using `clearTimezoneCache()`
6. All components automatically use new timezone

## Key Design Decisions

### Why Unified APIs?
- **Consistency**: Same business logic across all views
- **Performance**: Optimized queries for specific use cases
- **Security**: Role-based filtering at API level
- **Maintainability**: Centralized logic reduces duplication

### Why Centralized Business Logic?
- **Accuracy**: Calculations performed once, used everywhere
- **Testability**: Pure functions easy to unit test
- **Flexibility**: Easy to modify business rules
- **Debugging**: Single source of truth for calculations

### Why Role-Based Architecture?
- **Security**: Data access controlled at multiple layers
- **Scalability**: Easy to add new roles and permissions
- **User Experience**: Tailored interfaces for each role
- **Compliance**: Audit trail and access control

## Performance Optimizations

### Database Level
- **Selective queries** with only required columns
- **Indexed filtering** on frequently queried fields
- **Batch operations** for multiple user metrics

### API Level
- **Caching** for settings and timezone data
- **Pagination** for large data sets
- **Compression** for large responses
- **HTTP caching headers** (5-minute cache for timezone API)

### Client Level
- **Real-time updates** reduce polling overhead
- **Optimistic updates** for better user experience
- **Component-level caching** for expensive calculations
- **Request deduplication** for timezone API calls
- **localStorage persistence** for timezone data
- **Singleton pattern** for timezone manager

### Timezone API Performance Fix
**Problem**: Excessive timezone API calls (100+ requests) causing 500-700ms delays each, totaling 25-35 seconds of network time per page load

**Root Causes Identified**:
- Multiple components making individual timezone API calls
- No request deduplication - concurrent calls not shared
- No client-side caching - every component fetched independently
- MainContentWrapper calling refreshTimezone() on every mount + 5min intervals
- TimezoneContext making unnecessary API calls even with valid initial timezone
- useTimezone hook creating separate manager instances
- Server-side timezone hardcoded to 'UTC' instead of fetching from database

**Architectural Changes Implemented**:

1. **Centralized Client-Side Management** (`lib/utils/timezone-client.ts`)
   - Singleton pattern ensures only one manager instance
   - Request deduplication - concurrent calls share same promise
   - localStorage persistence survives page refreshes
   - 5-minute cache duration with automatic invalidation

2. **Fixed Server-Side Timezone Fetching** (`app/(app)/layout.tsx`)
   - Now fetches actual timezone from database instead of hardcoded 'UTC'
   - Proper error handling with fallback to UTC
   - Server-side rendering provides correct initial timezone

3. **Optimized TimezoneContext Logic** (`context/TimezoneContext.tsx`)
   - Skips API calls entirely when valid initial timezone provided
   - Pre-populates cache with server-side timezone data
   - Reduced refresh interval from 5 minutes to 30 minutes
   - Only sets up intervals when API calls actually needed

4. **Updated useTimezone Hook** (`hooks/useTimezone.ts`)
   - Now uses TimezoneContext instead of direct API calls
   - Eliminates duplicate manager instances across components

5. **Removed Redundant API Calls**
   - MainContentWrapper: Removed refreshTimezone() calls and intervals
   - Admin settings: Uses context instead of direct fetch calls
   - Cleaned up unused imports and redundant refresh logic

6. **Enhanced HTTP Caching** (`app/api/settings/timezone/route.ts`)
   - 5-minute browser cache for timezone API
   - Proper cache control and vary headers

7. **Improved Timezone Display** (`components/TimeDisplay.tsx`)
   - Shows city name instead of GMT offset ("Asia/Karachi" → "Karachi")
   - Maintains accuracy while improving readability

**Performance Results**:
- **Before**: 100+ API calls per page load (25-35 seconds network time)
- **After**: 0-2 API calls per session (<1 second network time)
- **User Experience**: Instant timezone loading with 0 API requests for cached data
- **Server Load**: Dramatically reduced from excessive redundant requests

**Reliability Features**:
- Fallback to UTC if API fails
- localStorage persistence across sessions
- Error handling with graceful degradation
- Cache invalidation when timezone updated
- Request deduplication prevents API overload
- Debug components for monitoring and troubleshooting

## Future Extensibility

### Adding New Roles
1. Update `UserSession` type in `session.ts`
2. Add role checks in relevant API endpoints
3. Create role-specific dashboard components
4. Update business logic for new access patterns

### Adding New Settings
1. Add setting to `app_settings` table
2. Update `getAppSettings()` query
3. Add validation in settings API
4. Create UI components for setting management

### Adding New Metrics
1. Create calculation function in appropriate utility module
2. Update relevant API endpoints to include new metric
3. Add client-side display components
4. Update real-time subscription handling

This architecture provides a solid foundation for the TimeScan application with clear separation of concerns, consistent patterns, and room for future growth.
