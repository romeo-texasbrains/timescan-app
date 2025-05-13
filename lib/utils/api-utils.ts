/**
 * Utility functions for API routes
 */

/**
 * Safely parse a URL from a request, handling both absolute and relative URLs
 * @param requestUrl The URL from the request object
 * @returns A parsed URL object
 */
export function parseRequestUrl(requestUrl: string): URL {
  try {
    // If it's already a valid URL (starts with http:// or https://), use it directly
    if (requestUrl.startsWith('http')) {
      return new URL(requestUrl);
    }
    
    // Otherwise, add a base URL to make it valid
    // This is needed because the URL constructor requires a base for relative URLs
    return new URL(requestUrl, 'http://localhost');
  } catch (error) {
    console.error('Error parsing URL:', error);
    // Fallback to a simple URL object with empty searchParams
    const fallbackUrl = new URL('http://localhost');
    
    // Try to extract query parameters manually if possible
    if (requestUrl.includes('?')) {
      const [, queryString] = requestUrl.split('?');
      if (queryString) {
        queryString.split('&').forEach(param => {
          const [key, value] = param.split('=');
          if (key && value) {
            fallbackUrl.searchParams.append(key, decodeURIComponent(value));
          }
        });
      }
    }
    
    return fallbackUrl;
  }
}
