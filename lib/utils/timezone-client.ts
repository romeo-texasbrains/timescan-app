'use client';

import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

/**
 * Client-side timezone management utility
 * Provides consistent timezone handling for client components
 */

/**
 * Validates if a timezone string is valid
 * @param timezone Timezone string to validate
 * @returns True if valid, false otherwise
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Formats a date/time in a specific timezone
 * @param date Date to format
 * @param timezone Timezone to format in
 * @param formatString Format string for date-fns
 * @returns Formatted date string
 */
export function formatInTimezone(
  date: Date | string,
  timezone: string,
  formatString: string = 'yyyy-MM-dd HH:mm:ss'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  try {
    return formatInTimeZone(dateObj, timezone, formatString);
  } catch (error) {
    console.error('Error formatting date in timezone:', error);
    // Fallback to UTC formatting
    return formatInTimeZone(dateObj, 'UTC', formatString);
  }
}

/**
 * Converts a date to a specific timezone
 * @param date Date to convert
 * @param timezone Timezone to convert to
 * @returns Date object in the specified timezone
 */
export function toTimezone(
  date: Date | string,
  timezone: string
): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  try {
    return toZonedTime(dateObj, timezone);
  } catch (error) {
    console.error('Error converting date to timezone:', error);
    // Fallback to UTC
    return toZonedTime(dateObj, 'UTC');
  }
}

/**
 * Gets timezone abbreviation for display
 * @param timezone Timezone string
 * @param date Optional date for DST calculation
 * @returns Timezone abbreviation
 */
export function getTimezoneAbbreviation(timezone: string, date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });

    const parts = formatter.formatToParts(date);
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');

    return timeZonePart?.value || timezone;
  } catch (error) {
    console.error('Error getting timezone abbreviation:', error);
    return timezone;
  }
}

/**
 * Gets a list of common timezones
 * @returns Array of timezone objects with label and value
 */
export function getCommonTimezones(): Array<{ label: string; value: string }> {
  return [
    { label: 'UTC', value: 'UTC' },
    { label: 'Eastern Time (ET)', value: 'America/New_York' },
    { label: 'Central Time (CT)', value: 'America/Chicago' },
    { label: 'Mountain Time (MT)', value: 'America/Denver' },
    { label: 'Pacific Time (PT)', value: 'America/Los_Angeles' },
    { label: 'Alaska Time (AKT)', value: 'America/Anchorage' },
    { label: 'Hawaii Time (HST)', value: 'Pacific/Honolulu' },
    { label: 'London (GMT/BST)', value: 'Europe/London' },
    { label: 'Paris (CET/CEST)', value: 'Europe/Paris' },
    { label: 'Tokyo (JST)', value: 'Asia/Tokyo' },
    { label: 'Sydney (AEST/AEDT)', value: 'Australia/Sydney' },
    { label: 'Mumbai (IST)', value: 'Asia/Kolkata' },
    { label: 'Dubai (GST)', value: 'Asia/Dubai' },
    { label: 'Toronto (ET)', value: 'America/Toronto' },
    { label: 'Vancouver (PT)', value: 'America/Vancouver' },
  ];
}

/**
 * Client-side timezone manager with request deduplication and caching
 * This should be used in React components
 */
export class ClientTimezoneManager {
  private static instance: ClientTimezoneManager;
  private timezone: string = 'UTC';
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private fetchPromise: Promise<string> | null = null;
  private isInitialized: boolean = false;
  private requestCount: number = 0; // Track API requests for debugging

  private constructor() {
    console.log('ClientTimezoneManager: Creating new instance');
    // Try to get timezone from localStorage on initialization
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('app_timezone');
      const cacheTime = localStorage.getItem('app_timezone_time');

      if (cached && cacheTime) {
        const now = Date.now();
        const lastCacheTime = parseInt(cacheTime, 10);

        if ((now - lastCacheTime) < this.CACHE_DURATION) {
          this.timezone = cached;
          this.lastFetch = lastCacheTime;
          this.isInitialized = true;
          console.log(`ClientTimezoneManager: Loaded from localStorage: ${cached}`);
        } else {
          console.log('ClientTimezoneManager: localStorage cache expired');
        }
      } else {
        console.log('ClientTimezoneManager: No localStorage cache found');
      }
    }
  }

  static getInstance(): ClientTimezoneManager {
    if (!ClientTimezoneManager.instance) {
      ClientTimezoneManager.instance = new ClientTimezoneManager();
    }
    return ClientTimezoneManager.instance;
  }

  async getTimezone(forceRefresh: boolean = false): Promise<string> {
    const now = Date.now();

    console.log(`ClientTimezoneManager: getTimezone called (forceRefresh: ${forceRefresh}, isInitialized: ${this.isInitialized}, cacheAge: ${now - this.lastFetch}ms)`);

    // Return cached value if still valid and not forcing refresh
    if (!forceRefresh && this.isInitialized && (now - this.lastFetch) < this.CACHE_DURATION) {
      console.log(`ClientTimezoneManager: Returning cached timezone: ${this.timezone}`);
      return this.timezone;
    }

    // If there's already a fetch in progress, return that promise
    if (this.fetchPromise && !forceRefresh) {
      console.log('ClientTimezoneManager: Fetch already in progress, waiting for existing promise');
      return this.fetchPromise;
    }

    // Create new fetch promise
    console.log('ClientTimezoneManager: Creating new fetch promise');
    this.fetchPromise = this.fetchTimezoneFromServer();

    try {
      const timezone = await this.fetchPromise;
      this.fetchPromise = null; // Clear the promise
      return timezone;
    } catch (error) {
      this.fetchPromise = null; // Clear the promise on error
      console.error('ClientTimezoneManager: Error fetching timezone:', error);
      return this.timezone; // Return cached value on error
    }
  }

  private async fetchTimezoneFromServer(): Promise<string> {
    try {
      this.requestCount++;
      console.log(`ClientTimezoneManager: Making API request #${this.requestCount} to /api/settings/timezone`);
      console.trace('API call stack trace:');

      const response = await fetch('/api/settings/timezone', {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        const timezone = data.timezone || 'UTC';

        // Update cache
        this.timezone = timezone;
        this.lastFetch = Date.now();
        this.isInitialized = true;

        // Store in localStorage for persistence
        if (typeof window !== 'undefined') {
          localStorage.setItem('app_timezone', timezone);
          localStorage.setItem('app_timezone_time', this.lastFetch.toString());
        }

        console.log(`Timezone fetched successfully: ${timezone}`);
        return timezone;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching timezone from server:', error);
      // Return cached value or default
      return this.timezone;
    }
  }

  clearCache(): void {
    this.timezone = 'UTC';
    this.lastFetch = 0;
    this.isInitialized = false;
    this.fetchPromise = null;

    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('app_timezone');
      localStorage.removeItem('app_timezone_time');
    }
  }

  getCurrentTimezone(): string {
    return this.timezone;
  }

  isTimezoneLoaded(): boolean {
    return this.isInitialized;
  }

  formatInTimezone(date: Date | string, formatString: string = 'yyyy-MM-dd HH:mm:ss'): string {
    return formatInTimezone(date, this.timezone, formatString);
  }

  /**
   * Pre-populate the cache with a timezone value (e.g., from server-side rendering)
   * This prevents unnecessary API calls when we already have the timezone
   */
  setTimezone(timezone: string): void {
    if (isValidTimezone(timezone)) {
      console.log(`ClientTimezoneManager: Pre-populating cache with timezone: ${timezone}`);
      this.timezone = timezone;
      this.lastFetch = Date.now();
      this.isInitialized = true;

      // Store in localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_timezone', timezone);
        localStorage.setItem('app_timezone_time', this.lastFetch.toString());
      }
    } else {
      console.warn(`ClientTimezoneManager: Attempted to set invalid timezone: ${timezone}`);
    }
  }

  /**
   * Get debug information about the manager state
   */
  getDebugInfo(): object {
    return {
      timezone: this.timezone,
      isInitialized: this.isInitialized,
      lastFetch: this.lastFetch,
      cacheAge: Date.now() - this.lastFetch,
      requestCount: this.requestCount,
      hasPendingRequest: !!this.fetchPromise
    };
  }
}
