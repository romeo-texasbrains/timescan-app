import { NextRequest } from 'next/server';

/**
 * Safely extracts search parameters from a NextRequest object
 * Handles both client-side and server-side calls
 * @param request The NextRequest object
 * @param fallbackUrl Optional fallback URL for server-side calls
 * @returns URLSearchParams object
 */
export function getSearchParams(request: NextRequest, fallbackUrl?: string): URLSearchParams {
  try {
    // Try to use nextUrl.searchParams first (client-side calls)
    if (request.nextUrl && request.nextUrl.searchParams) {
      return request.nextUrl.searchParams;
    }
    
    // For server-side calls, parse URL manually
    const url = new URL(request.url || fallbackUrl || 'http://localhost:3000');
    return url.searchParams;
  } catch (error) {
    console.warn('Error parsing search parameters:', error);
    // Fallback to empty search params
    return new URLSearchParams();
  }
}

/**
 * Safely gets a query parameter value with optional type conversion
 * @param searchParams URLSearchParams object
 * @param key Parameter key
 * @param defaultValue Default value if parameter is not found
 * @returns Parameter value or default value
 */
export function getQueryParam(
  searchParams: URLSearchParams, 
  key: string, 
  defaultValue?: string
): string | undefined {
  const value = searchParams.get(key);
  return value !== null ? value : defaultValue;
}

/**
 * Safely gets a query parameter as a boolean
 * @param searchParams URLSearchParams object
 * @param key Parameter key
 * @param defaultValue Default value if parameter is not found
 * @returns Boolean value
 */
export function getQueryParamAsBoolean(
  searchParams: URLSearchParams, 
  key: string, 
  defaultValue: boolean = false
): boolean {
  const value = searchParams.get(key);
  if (value === null) return defaultValue;
  return value === 'true' || value === '1';
}

/**
 * Safely gets a query parameter as a number
 * @param searchParams URLSearchParams object
 * @param key Parameter key
 * @param defaultValue Default value if parameter is not found or invalid
 * @param min Optional minimum value
 * @param max Optional maximum value
 * @returns Number value
 */
export function getQueryParamAsNumber(
  searchParams: URLSearchParams, 
  key: string, 
  defaultValue: number,
  min?: number,
  max?: number
): number {
  const value = searchParams.get(key);
  if (value === null) return defaultValue;
  
  const numValue = parseInt(value, 10);
  if (isNaN(numValue)) return defaultValue;
  
  // Apply min/max constraints if provided
  let result = numValue;
  if (min !== undefined && result < min) result = min;
  if (max !== undefined && result > max) result = max;
  
  return result;
}

/**
 * Creates a standardized error response
 * @param message Error message
 * @param status HTTP status code
 * @param details Optional additional error details
 * @returns Response object
 */
export function createErrorResponse(
  message: string, 
  status: number = 500, 
  details?: any
) {
  const errorBody: any = { error: message };
  if (details) {
    errorBody.details = details;
  }
  
  return Response.json(errorBody, { status });
}

/**
 * Creates a standardized success response
 * @param data Response data
 * @param metadata Optional metadata
 * @returns Response object
 */
export function createSuccessResponse(data: any, metadata?: any) {
  const responseBody: any = data;
  if (metadata) {
    responseBody._metadata = metadata;
  }
  
  return Response.json(responseBody);
}
