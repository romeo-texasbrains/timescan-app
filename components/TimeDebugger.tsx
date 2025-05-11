'use client'

import React from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { parseISO, format } from 'date-fns';

interface TimeDebuggerProps {
  timestamp: string | null;
  timezone: string;
  label: string;
}

/**
 * A component for debugging time conversion issues
 * This component displays a timestamp in various formats to help debug timezone issues
 */
export default function TimeDebugger({ timestamp, timezone, label }: TimeDebuggerProps) {
  if (!timestamp) return null;

  try {
    const date = parseISO(timestamp);
    const utcString = date.toISOString();
    const utcTime = utcString.substring(11, 19);
    const utcDate = utcString.substring(0, 10);

    // Format in the specified timezone
    const tzTime = formatInTimeZone(date, timezone, 'HH:mm:ss');
    const tzDate = formatInTimeZone(date, timezone, 'yyyy-MM-dd');
    const tzFormatted = formatInTimeZone(date, timezone, 'h:mm a');
    const tzDateTime = formatInTimeZone(date, timezone, 'yyyy-MM-dd HH:mm:ss');

    // Get timezone abbreviation
    const tzAbbr = formatInTimeZone(date, timezone, 'zzz');

    // Calculate the actual offset in hours for this specific timezone
    const tzOffsetMinutes = formatInTimeZone(date, timezone, 'x');
    const tzOffsetHours = parseInt(tzOffsetMinutes) / 60 / 1000 / 60;

    // Calculate offset in hours
    const offsetMinutes = date.getTimezoneOffset();
    const offsetHours = -offsetMinutes / 60; // Negate because getTimezoneOffset returns minutes west of UTC

    return (
      <div className="bg-muted/20 p-2 rounded-md text-xs my-1">
        <div className="font-semibold">{label} Time Debug:</div>
        <div className="grid grid-cols-2 gap-x-2">
          <div>Raw timestamp:</div>
          <div className="font-mono">{timestamp}</div>

          <div>UTC:</div>
          <div className="font-mono">{utcDate} {utcTime}</div>

          <div>In {timezone}:</div>
          <div className="font-mono">{tzDate} {tzTime} ({tzAbbr})</div>

          <div>Full datetime in {timezone}:</div>
          <div className="font-mono">{tzDateTime}</div>

          <div>Formatted for display:</div>
          <div className="font-mono">{tzFormatted}</div>

          <div>Timezone offset:</div>
          <div className="font-mono">UTC{tzOffsetHours >= 0 ? '+' : ''}{tzOffsetHours}</div>

          <div>Browser offset:</div>
          <div className="font-mono">UTC{offsetHours >= 0 ? '+' : ''}{offsetHours}</div>
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="bg-red-100 p-2 rounded-md text-xs my-1">
        <div className="font-semibold text-red-600">Error parsing timestamp: {String(error)}</div>
        <div>Raw timestamp: {timestamp}</div>
      </div>
    );
  }
}
