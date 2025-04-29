# TimeScan - Internal Attendance Tracking App

## 1. Purpose

To develop a modern, mobile-optimized web application ("TimeScan") enabling employees to track their work attendance by scanning a QR code using their mobile devices. This replaces manual sign-in sheets or legacy systems, providing accurate records and simplifying reporting for management.

## 2. Technology Stack

*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **Backend/DB:** Supabase (Auth, PostgreSQL, RLS)
*   **Styling:** Tailwind CSS
*   **Deployment:** Vercel (planned)

## 3. Core Features (V1)

*   User Roles: `employee`, `manager`, `admin`
*   Authentication via Supabase (Email/Password)
*   QR Code display mechanism
*   Mobile QR Code scanning for Sign-in/Sign-out
*   Attendance logging in Supabase DB
*   Manager/Admin reporting dashboard & filtering
*   Manual attendance adjustments (Managers/Admins)
*   Employee self-view of attendance history

## 4. Project Structure

```plaintext
./  # NEW: Project root
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── callback/route.ts
│   ├── (app)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── scan/page.tsx
│   │   ├── history/page.tsx
│   │   ├── mgmt/     # Needs implementation
│   │   └── admin/
│   │       ├── layout.tsx
│   │       └── page.tsx
│   │       └── employees/    # NEW: Added for employee management
│   │           └── page.tsx # NEW: Added for employee management
│   ├── api/
│   │   └── attendance/route.ts
│   ├── layout.tsx
│   ├── page.tsx # Should redirect or be removed if not used
│   └── globals.css
├── components/
│   ├── ui/         # Needs implementation
│   ├── auth/       # Needs implementation
│   ├── layout/     # Needs implementation
│   ├── attendance/ # Needs implementation (partially QrScanner?)
│   ├── common/     # Needs implementation
│   ├── ClientRootLayout.tsx
│   ├── DashboardClient.tsx
│   ├── QrScanner.tsx
│   ├── Sidebar.tsx
│   └── Topbar.tsx
├── lib/
│   ├── supabase/   # Client/Server/Middleware helpers exist
│   │   └── database.types.ts # Assumed generated
│   ├── utils.ts    # Needs implementation
│   ├── hooks/      # Needs implementation
│   ├── constants.ts # Needs implementation
│   └── types/      # Needs implementation
├── public/
├── styles/ # Likely not used directly if Tailwind preferred
├── supabase/ # Optional
│   └── ...
├── .env.local
├── .gitignore
├── middleware.ts
├── next.config.ts # Updated from .mjs
├── package.json
├── postcss.config.mjs # Added
├── eslint.config.mjs # Added
└── tsconfig.json
```

## 5. Getting Started

*(Instructions still needed)*

## 6. Supabase Setup

*(Instructions still needed, RLS/Triggers critical)*

## 7. Development Roadmap / Tasks (Updated Status)

This outlines the planned steps to build the application, updated based on recent review.

**Phase 1: Project Setup & Base Configuration (Mostly Done)**

1.  ✅ **Initialize Next.js Project**
2.  ✅ **Install Dependencies:** `react-qr-reader` replaced by `html5-qrcode`
3.  ✅ **Create Core Directories**
4.  ✅ **Set up Supabase Project**
5.  ✅ **Configure Environment Variables**
6.  ✅ **Initialize Supabase Client Instances**

**Phase 2: Authentication & Base Layout (Mostly Done)**

7.  ✅ **Set up Supabase Auth UI/Logic:** Login page (`app/(auth)/login/page.tsx`)
8.  ✅ **Implement Auth Callback:** `app/(auth)/callback/route.ts`
9.  ✅ **Create Root Middleware:** Protect `(app)` routes (`middleware.ts`)
10. ✅ **Create Authenticated Layout:** `app/(app)/layout.tsx`
11. ✅ **Implement Logout:** Add logout functionality
12. ✅ **Generate Supabase Types**

**Phase 3: Database Schema & Security (Supabase) (Done)**

13. ✅ Define `profiles` Table
14. ✅ Define `attendance_logs` Table
15. ✅ **Implement `profiles` RLS:** (Users manage own, Admins manage all)
16. ✅ **Implement `attendance_logs` RLS:** (Users insert/view own, Admins manage all)
17. ✅ **Create Auto-Profile Trigger:** (Creates profile on user signup, default role 'employee')

**Phase 4: Core Employee Features (Done)**

18. ✅ **Build Scan Page UI:** `app/(app)/scan/page.tsx`
19. ✅ **Implement QR Scanning Logic:** Integrated `html5-qrcode`, added comprehensive status/error feedback, and added "Start Scan" button flow (`components/QrScanner.tsx`, `app/(app)/scan/page.tsx`).
20. ✅ **Implement Scan Processing (Backend):** API route validates required `TIMESCAN-LOC:` prefix (`app/api/attendance/route.ts`).
21. ✅ **Build History Page UI:** `app/(app)/history/page.tsx` (Includes pagination)
22. ✅ **Implement History Data Fetching:** Fetches & displays user's logs respecting RLS and pagination.

**Phase 5: Manager Features (Needs Implementation)**

23. 🔧 **Implement Role Checks:** Middleware/Layout checks for `manager` role. (Done in Layout/Sidebar, needs RLS)
24. **Build Manager Dashboard**
25. **Build Reports Page:** `app/(app)/mgmt/reports/page.tsx`
26. **Build Manual Adjustments Page:** `app/(app)/mgmt/adjustments/page.tsx`

**Phase 6: Admin Features (Partially Done)**

27. ✅ **Implement Admin Role Checks:** Middleware/Layout checks for `admin` role. (Layout checks in `app/(app)/admin/layout.tsx`, Sidebar link fixed in `components/Sidebar.tsx`)
28. ✅ **Build Admin Dashboard/Overview:** `app/(app)/admin/page.tsx` (Refined existing page, added link cards)
29. ✅ **Build User Management Page:** `app/(app)/admin/employees/page.tsx` 
    *   ✅ Basic employee list table implemented with pagination.
    *   ✅ Add Employee form and server action implemented (`/admin/employees/new`).
    *   ✅ Edit/View Employee: UI placeholders present, implementation completed.
    *   ✅ Filtering/sorting to employee list: Implemented.
    *   ✅ Admin: Edit Attendance Log (`/admin/logs/[id]`) page created with working edit form.
30. ✅ **Build Settings Page:** `/admin/settings` (Basic save/load implemented)
31. ✅ **NEW:** Build Reports Page: `/admin/reports` (Filtering and aggregation implemented)
    *   ⏳ Export functionality deferred.
31.5. ✅ **NEW:** Build QR Code Management Page: `/admin/qr-codes` (Generate, display, save, delete)

**Phase 7: UI Polishing & Refinement (Needs Implementation)**

32. **Develop Reusable UI Components:** `components/ui/`
33. 🔧 **Apply Consistent Styling:** (Ongoing)
34. 🔧 **Improve Error Handling & Feedback:** Add toasts, scanner messages, etc. (Partially Addressed, Needs More)
35. 🔧 **Ensure Mobile Responsiveness:** (Needs Review)
36. 🔧 **Add Loading States:** Login form, dashboard actions
37. **NEW:** Implement Dashboard: Punch Out Button functionality
38. **NEW:** Implement Dashboard: Dynamic Break/Overtime calculation
39. 🔧 **NEW:** Fix Type Safety (`any` usage)
40. 🔧 **NEW:** Review/Fix non-functional Topbar elements (Search, Notifications)
41. 🔧 **NEW:** Update default App Title/Metadata

**Phase 8: Testing & Deployment (Needs Implementation)**

42. **Manual Testing:** Test all flows and roles
43. **Deployment:** Configure and deploy to Vercel
44. **Production Testing:** Final checks on live deployment

## 9. Technical Notes & Gotchas

*   **Next.js 15 Dynamic API Changes (searchParams, cookies, headers):**
    *   **Issue:** In Next.js 15+, accessing properties of dynamic APIs like `searchParams` directly within Server Components (e.g., `page.tsx`) without first `await`-ing the API itself will cause warnings or errors (`searchParams should be awaited before using its properties`).
    *   **Solution:** Always `await` the dynamic API prop/function *before* accessing its properties or passing it to other functions. Example for `searchParams`:
        ```typescript
        export default async function MyPage({ searchParams }) {
          // GOOD: Await searchParams first
          const awaitedSearchParams = await searchParams;
          const pageValue = awaitedSearchParams?.page; // Access properties *after* await
          
          // Use pageValue, e.g., pass to a data fetching function
          const data = await fetchData(pageValue);
          
          // ... render ...
        }
        ```
    *   **Reference:** See [Next.js Docs: Dynamic APIs are Asynchronous](https://nextjs.org/docs/messages/sync-dynamic-apis)

*   **Client Component Hydration Errors (e.g., Charting Libraries):**
    *   **Issue:** Libraries that generate dynamic IDs, classes, or rely heavily on browser APIs (like `recharts`) can cause hydration errors when rendered server-side because the server output doesn't match the initial client render.
    *   **Solution:** Use `next/dynamic` to import the problematic component (or the section containing it) with Server-Side Rendering (SSR) disabled:
        ```typescript
        import dynamic from 'next/dynamic';

        const DynamicChart = dynamic(() => import('@/components/MyChartComponent'), {
          ssr: false,
          loading: () => <p>Loading chart...</p> // Optional
        });

        export default function Page() {
          return <DynamicChart />;
        }
        ```

*   **NEW:** Key Next.js technical notes and solutions are maintained in `NEXTJS_NOTES.md` for reference.

## 10. Testing Standards & Approach (Renumbered from 8)

### Test Setup
- Jest + React Testing Library
- TypeScript support via Babel
- JSDOM for browser environment simulation
- Proper mocking for:
  - CSS/Style imports
  - Static assets
  - External dependencies (Supabase, Next.js)

### Testing Best Practices
1. **Component Tests**
   - Use `@testing-library/user-event` for realistic user interactions
   - Test behavior, not implementation
   - Mock external dependencies (API calls, routing)
   - Aim for >90% coverage on critical components

2. **Test Structure**
   ```typescript
   describe('ComponentName', () => {
     const user = userEvent.setup()
     
     beforeEach(() => {
       jest.clearAllMocks()
     })

     it('should render correctly', () => {
       // Test initial render
     })

     it('should handle user interactions', async () => {
       // Test user flows
     })

     it('should handle async operations', async () => {
       // Test loading states, API calls
     })
   })
   ```

3. **Mocking Standards**
   ```typescript
   // External service mocks
   const mockExternalFunction = jest.fn()
   jest.mock('@/lib/service', () => ({
     serviceFunction: (...args) => mockExternalFunction(...args)
   }))

   // Next.js specific mocks
   jest.mock('next/navigation', () => ({
     useRouter: () => ({
       push: jest.fn(),
       refresh: jest.fn()
     })
   }))
   ```

4. **Configuration Files**
   - `.babelrc` - TypeScript & React support
   - `jest.config.js` - Module mapping & coverage
   - `jest.setup.js` - Global test setup
   - `__mocks__/` - Global mocks for assets

### Test Categories
1. **Unit Tests** (`__tests__/*.test.tsx`)
   - Individual component behavior
   - Form validation
   - State management
   - Error handling

2. **Integration Tests** (Planned)
   - API route testing
   - Middleware functionality
   - Multi-component workflows

3. **E2E Tests** (Future)
   - Full user journeys
   - Cross-component interactions
   - Real API integration
