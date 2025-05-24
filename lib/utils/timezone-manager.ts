import { getAppSettings } from '@/lib/db/queries';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

/**
 * Centralized timezone management utility
 * Provides consistent timezone handling across the application
 */

let cachedTimezone: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Gets the application timezone with caching
 * @param forceRefresh Force refresh from database
 * @returns The application timezone
 */
export async function getAppTimezone(forceRefresh: boolean = false): Promise<string> {
  const now = Date.now();

  // Return cached value if it's still valid and not forcing refresh
  if (!forceRefresh && cachedTimezone && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedTimezone;
  }

  try {
    const settings = await getAppSettings();
    cachedTimezone = settings.timezone || 'UTC';
    cacheTimestamp = now;
    return cachedTimezone;
  } catch (error) {
    console.error('Error fetching timezone:', error);
    // Return cached value if available, otherwise default to UTC
    return cachedTimezone || 'UTC';
  }
}

/**
 * Clears the timezone cache
 * Should be called when timezone is updated
 */
export function clearTimezoneCache(): void {
  cachedTimezone = null;
  cacheTimestamp = 0;
}

/**
 * Formats a date/time in the application timezone
 * @param date Date to format
 * @param formatString Format string for date-fns
 * @param timezone Optional timezone override
 * @returns Formatted date string
 */
export async function formatInAppTimezone(
  date: Date | string,
  formatString: string = 'yyyy-MM-dd HH:mm:ss',
  timezone?: string
): Promise<string> {
  const tz = timezone || await getAppTimezone();
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  try {
    return formatInTimeZone(dateObj, tz, formatString);
  } catch (error) {
    console.error('Error formatting date in timezone:', error);
    // Fallback to UTC formatting
    return formatInTimeZone(dateObj, 'UTC', formatString);
  }
}

/**
 * Converts a date to the application timezone
 * @param date Date to convert
 * @param timezone Optional timezone override
 * @returns Date object in the application timezone
 */
export async function toAppTimezone(
  date: Date | string,
  timezone?: string
): Promise<Date> {
  const tz = timezone || await getAppTimezone();
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  try {
    return toZonedTime(dateObj, tz);
  } catch (error) {
    console.error('Error converting date to timezone:', error);
    // Fallback to UTC
    return toZonedTime(dateObj, 'UTC');
  }
}

/**
 * Gets the current time in the application timezone
 * @param timezone Optional timezone override
 * @returns Current date in the application timezone
 */
export async function getCurrentTimeInAppTimezone(timezone?: string): Promise<Date> {
  return toAppTimezone(new Date(), timezone);
}

/**
 * Formats the current time in the application timezone
 * @param formatString Format string for date-fns
 * @param timezone Optional timezone override
 * @returns Formatted current time string
 */
export async function formatCurrentTimeInAppTimezone(
  formatString: string = 'yyyy-MM-dd HH:mm:ss',
  timezone?: string
): Promise<string> {
  return formatInAppTimezone(new Date(), formatString, timezone);
}

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
 * Server-side timezone utilities
 * Note: Client-side timezone management is now in timezone-client.ts
 */
