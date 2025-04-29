# Next.js Technical Notes & Learnings

This file documents key technical insights, best practices, and solutions specific to Next.js, especially those learned from the official documentation ([https://nextjs.org/docs](https://nextjs.org/docs)) that might differ from older patterns.

## 1. Next.js 15+ Dynamic API Changes (searchParams, cookies, headers)

*   **Issue:** In Next.js 15+, accessing properties of dynamic APIs like `searchParams`, `cookies()`, or `headers()` directly within Server Components (e.g., `page.tsx`, `layout.tsx`) *before* awaiting the API itself will cause warnings or errors (e.g., `searchParams should be awaited before using its properties`).
*   **Solution:** Always `await` the dynamic API prop or function *before* accessing its properties or passing its value to other functions.
    *   **Example for `searchParams`:**
        ```typescript
        // app/some/route/page.tsx
        export default async function MyPage({ searchParams }) {
          // GOOD: Await searchParams first
          const awaitedSearchParams = await searchParams;
          const pageValue = awaitedSearchParams?.page; // Access properties *after* await
          
          // Use pageValue
          const data = await fetchData(pageValue);
          
          // ... render ...
        }
        ```
    *   **Example for `cookies()`:**
        ```typescript
        import { cookies } from 'next/headers';

        export default async function MyServerComponent() {
          // GOOD: Await cookies() first
          const cookieStore = await cookies(); 
          const theme = cookieStore.get('theme'); // Access methods/properties *after* await

          // ... use theme ...
        }
        ```
*   **Reference:** [Next.js Docs: Dynamic APIs are Asynchronous](https://nextjs.org/docs/messages/sync-dynamic-apis)

## 2. Client Component Hydration Errors (e.g., Charting Libraries)

*   **Issue:** Libraries that generate dynamic IDs, classes, depend on browser-specific APIs, or perform calculations resulting in different server/client initial renders (common with charting libraries like `recharts`) can cause React hydration errors.
*   **Solution:** Use `next/dynamic` to import the component (or the specific part of the JSX causing the issue) with Server-Side Rendering (SSR) disabled. This ensures the component only renders on the client.
    ```typescript
    import dynamic from 'next/dynamic';

    // Dynamically import MyChartComponent with ssr: false
    const DynamicChart = dynamic(() => import('@/components/MyChartComponent'), {
      ssr: false,
      loading: () => <p>Loading chart...</p> // Optional loading indicator
    });

    export default function Page() {
      // Render the dynamically imported component
      return <DynamicChart />;
    }
    ```
*   **Reference:** Implicitly covered under Client Components and rendering patterns in Next.js docs. 