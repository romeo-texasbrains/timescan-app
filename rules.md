# API Design Rules & Best Practices

## Unified API vs. Specialized Endpoints

When designing a new API endpoint, consider these factors to determine whether to create a unified API or specialized endpoints:

### Use Unified APIs When:

1. **Multiple UI components need the same data structure**
   - Example: Both admin and manager dashboards need the same employee status information
   - Solution: Create a single `/api/dashboard/data` endpoint with role-based filtering

2. **Business logic needs to be consistently applied**
   - Example: Adherence status calculation must be identical across all dashboards
   - Solution: Create a unified endpoint that uses the same calculation utilities

3. **Data needs to be synchronized across views**
   - Example: Employee status should be consistent between admin view and employee's self-view
   - Solution: Use the same underlying data fetching and processing logic

### Use Specialized Endpoints When:

1. **Data needs are fundamentally different**
   - Example: Employee dashboard needs personal metrics vs. admin dashboard needs team overview
   - Solution: Create separate `/api/dashboard/user` and `/api/dashboard/data` endpoints

2. **Performance considerations require different data shapes**
   - Example: History view needs detailed logs vs. dashboard needs summarized metrics
   - Solution: Create specialized endpoints optimized for each use case

3. **Security boundaries are clearly different**
   - Example: Employee attendance history vs. company-wide reports
   - Solution: Create separate endpoints with appropriate access controls

## Role-Based Access Control

Always consider role-based access when designing APIs:

1. **Determine access patterns early**
   - Who needs access to this data? (admin, manager, employee, public)
   - What subset of data should each role see?
   - Are there any cross-cutting concerns (e.g., department boundaries)?

2. **Implement consistent authorization checks**
   - Use centralized utilities like `requireRole(['admin', 'manager'])`
   - Apply filtering based on role (e.g., managers only see their department)
   - Return appropriate HTTP status codes (401 for unauthenticated, 403 for unauthorized)

3. **Document access control expectations**
   - Clearly specify which roles can access each endpoint
   - Document any special filtering that occurs based on role

## Centralized Business Logic

Determine if the API should use centralized business logic:

1. **Identify calculation-heavy operations**
   - Time calculations, status determinations, metrics aggregation
   - Complex business rules that may change over time
   - Anything that needs to be consistent across multiple views

2. **Extract to dedicated utility modules**
   - Create purpose-specific modules (e.g., `adherence-calculator.ts`)
   - Design pure functions that take inputs and return outputs
   - Avoid side effects and database calls in business logic modules

3. **Ensure reusability across endpoints**
   - Business logic should be importable by any API endpoint
   - Parameters should be flexible enough for different contexts
   - Return values should be structured for easy consumption

## Reusable Data Access Modules

Consider data access patterns:

1. **Identify common database queries**
   - User fetching, attendance logs, department information
   - Queries that are used across multiple endpoints
   - Queries with complex filtering or joins

2. **Create dedicated query functions**
   - Group in logical modules (e.g., `queries.ts` or separate files by entity)
   - Use flexible parameters for filtering
   - Return raw data that can be processed by business logic

3. **Separate concerns**
   - Data access modules should only fetch data, not process it
   - Business logic modules should process data, not fetch it
   - API endpoints should orchestrate the flow between data and logic

## API Response Structure

Maintain consistent response structures:

1. **Use consistent naming conventions**
   - Use camelCase for all properties
   - Use descriptive names that match their UI usage
   - Include metadata like timestamps and counts when relevant

2. **Include necessary context**
   - Always include timezone information for time-based data
   - Include user role information when relevant to rendering
   - Provide counts, totals, or other summary information

3. **Structure for efficient client consumption**
   - Match the structure to how it will be used in the UI
   - Group related data logically (e.g., by department, by date)
   - Include formatted values when they'll be displayed directly

## Error Handling

Implement consistent error handling:

1. **Use appropriate HTTP status codes**
   - 200: Success
   - 400: Bad request (invalid parameters)
   - 401: Unauthorized (not authenticated)
   - 403: Forbidden (authenticated but not authorized)
   - 404: Not found
   - 500: Server error

2. **Provide helpful error messages**
   - Include specific error details for debugging
   - Log detailed errors server-side
   - Return user-friendly messages to the client

3. **Handle edge cases**
   - Empty data sets
   - Missing or invalid parameters
   - Database connection issues

## Performance Considerations

Optimize API performance:

1. **Fetch only what's needed**
   - Use selective column queries
   - Implement pagination for large data sets
   - Allow filtering to reduce data transfer

2. **Consider caching strategies**
   - Use `cache: 'no-store'` for real-time data
   - Consider short TTL caching for semi-static data
   - Implement ETags or conditional requests for large responses

3. **Optimize database queries**
   - Use appropriate indexes
   - Combine related queries when possible
   - Consider denormalization for frequently accessed data

## Decision Checklist for New APIs

When creating a new API endpoint, ask:

1. **Purpose & Scope**
   - What specific need does this API fulfill?
   - Which components or pages will consume this API?
   - Is this a one-time use or will it be reused?

2. **Data Requirements**
   - What data needs to be returned?
   - Is this data already available through another endpoint?
   - Can existing endpoints be modified to include this data?

3. **Access Control**
   - Which roles should have access?
   - What filtering should be applied based on role?
   - Are there any special security considerations?

4. **Business Logic**
   - What calculations or transformations are needed?
   - Is this logic already implemented elsewhere?
   - Should this logic be centralized for reuse?

5. **Performance & Scalability**
   - How frequently will this API be called?
   - How much data will be returned?
   - Are there any potential bottlenecks?

6. **Maintenance**
   - Who will maintain this API?
   - How might requirements change over time?
   - Is the implementation flexible enough for future needs?

By considering these factors, you can make informed decisions about API design that balance immediate needs with long-term architectural goals.

## Performance Optimization Rules

### Rule 1: Always Investigate Root Causes Before Optimizing
- **Don't assume** the obvious solution is correct
- **Use debugging tools** (console logs, network tab, stack traces) to identify all sources of performance issues
- **Document findings** - performance problems often have multiple contributing factors
- **Example**: Timezone API calls came from 7 different sources, not just one component

### Rule 2: Centralize Resource Management
- **Use singleton patterns** for shared resources (API clients, managers, caches)
- **Prevent duplicate instances** across components
- **Create centralized contexts** instead of letting each component manage its own state
- **Example**: Single TimezoneManager instance vs. multiple instances per component

### Rule 3: Implement Strategic Caching
- **Layer caching strategies**: localStorage + memory cache + HTTP cache
- **Use request deduplication** to prevent concurrent duplicate requests
- **Set appropriate cache durations** based on data volatility
- **Implement cache invalidation** when data changes
- **Example**: 5-minute timezone cache with localStorage persistence

### Rule 4: Fix Server-Side Issues First
- **Server-side problems** often manifest as client-side performance issues
- **Fetch data server-side** when possible to reduce client API calls
- **Use proper error handling** with fallback mechanisms
- **Example**: Hardcoded 'UTC' server-side caused excessive client-side API calls

### Rule 5: Monitor and Debug Performance
- **Add performance monitoring** to critical paths
- **Create debug tools** for real-time performance tracking
- **Use stack traces** to identify call sources
- **Implement request counting** and timing metrics
- **Example**: Debug component showing API request count and cache status

### Rule 6: Eliminate Redundant Operations
- **Audit all components** for duplicate functionality
- **Remove unnecessary intervals** and periodic refreshes
- **Consolidate similar operations** into shared utilities
- **Clean up unused imports** and dead code
- **Example**: Removed redundant refreshTimezone() calls and 5-minute intervals

### Rule 7: Optimize User Experience Over Technical Metrics
- **Prioritize perceived performance** (instant loading from cache)
- **Provide meaningful feedback** (show city names vs. GMT offsets)
- **Implement graceful degradation** when systems fail
- **Maintain functionality** while improving performance
- **Example**: 0 API requests for cached data with fallback to server when needed

## Case Study: Timezone/Settings API

**Problem**: Multiple components needed timezone information, leading to inconsistent time displays and 404 errors.

**Decision**: Created a unified settings API with specialized timezone endpoint for backward compatibility.

**Implementation**:
- `/api/settings` - Unified settings API with role-based access
- `/api/settings/timezone` - Specialized timezone endpoint for backward compatibility
- `lib/utils/timezone-manager.ts` - Centralized timezone business logic
- Caching layer to reduce database calls

**Benefits**:
- Consistent timezone handling across all components
- Centralized timezone validation and formatting
- Role-based access control (admins can update, others can read)
- Performance optimization through caching
- Backward compatibility maintained

**Key Learnings**:
- Cross-cutting concerns like timezone need unified APIs
- Caching is essential for frequently accessed settings
- Backward compatibility can be maintained with specialized endpoints
- Centralized business logic prevents inconsistencies
