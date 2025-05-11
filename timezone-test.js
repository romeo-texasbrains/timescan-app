// Simple test file to verify date-fns-tz behavior
const { formatInTimeZone, toDate } = require('date-fns-tz');
const { parseISO, format } = require('date-fns');

// Test timezone conversion for Asia/Karachi (UTC+5)
const testLocalString = '2025-05-09T07:27:00';
const testTimezone = 'Asia/Karachi';

console.log(`Testing timezone conversion for ${testLocalString} in ${testTimezone}`);

try {
  // Parse the local datetime string
  const localDate = parseISO(testLocalString);
  console.log(`Parsed local date: ${localDate.toISOString()}`);

  // Manual conversion using the known offset for Asia/Karachi (UTC+5)
  const manualUtcDate = new Date(localDate);
  manualUtcDate.setHours(manualUtcDate.getHours() - 5);
  console.log(`Manual UTC conversion (UTC+5): ${manualUtcDate.toISOString()}`);

  // Test with toDate from date-fns-tz
  const tzDate = toDate(testLocalString, { timeZone: testTimezone });
  console.log(`toDate result: ${tzDate.toISOString()}`);

  // Test with formatInTimeZone
  const formattedInTz = formatInTimeZone(parseISO(testLocalString), testTimezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  console.log(`formatInTimeZone result: ${formattedInTz}`);

  // Test a second time value
  const testLocalString2 = '2025-05-09T16:00:00';
  console.log(`\nTesting timezone conversion for ${testLocalString2} in ${testTimezone}`);

  const localDate2 = parseISO(testLocalString2);
  console.log(`Parsed local date: ${localDate2.toISOString()}`);

  const manualUtcDate2 = new Date(localDate2);
  manualUtcDate2.setHours(manualUtcDate2.getHours() - 5);
  console.log(`Manual UTC conversion (UTC+5): ${manualUtcDate2.toISOString()}`);

  const tzDate2 = toDate(testLocalString2, { timeZone: testTimezone });
  console.log(`toDate result: ${tzDate2.toISOString()}`);

  const formattedInTz2 = formatInTimeZone(parseISO(testLocalString2), testTimezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  console.log(`formatInTimeZone result: ${formattedInTz2}`);

  // Test overnight shift
  const signinTime = '19:25';
  const signoutTime = '03:20';
  console.log(`\nTesting overnight shift detection: signin=${signinTime}, signout=${signoutTime}`);

  const [signinHours, signinMinutes] = signinTime.split(':').map(Number);
  const [signoutHours, signoutMinutes] = signoutTime.split(':').map(Number);

  const signinTotalMinutes = signinHours * 60 + signinMinutes;
  const signoutTotalMinutes = signoutHours * 60 + signoutMinutes;

  const isOvernight = signoutTotalMinutes < signinTotalMinutes;
  console.log(`Is overnight shift: ${isOvernight}`);

  // Test our timeToUTC function logic with a simplified implementation
  console.log('\nTesting simplified timeToUTC function:');

  // Simulate the timeToUTC function for signin
  const shiftAnchorDate = '2025-05-10';
  const signinTimeStr = '19:25';
  const signinLocalDateTimeStr = `${shiftAnchorDate}T${signinTimeStr}:00`;
  console.log(`Signin local datetime: ${signinLocalDateTimeStr}`);

  const signinUtcDate = toDate(signinLocalDateTimeStr, { timeZone: testTimezone });
  console.log(`Signin UTC: ${signinUtcDate.toISOString()}`);

  // Simulate the timeToUTC function for signout (overnight)
  const signoutTimeStr = '03:20';
  // For overnight shifts, use the next day for signout
  const nextDay = new Date(shiftAnchorDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = format(nextDay, 'yyyy-MM-dd');

  const signoutLocalDateTimeStr = `${nextDayStr}T${signoutTimeStr}:00`;
  console.log(`Signout local datetime (overnight): ${signoutLocalDateTimeStr}`);

  const signoutUtcDate = toDate(signoutLocalDateTimeStr, { timeZone: testTimezone });
  console.log(`Signout UTC: ${signoutUtcDate.toISOString()}`);

  // Calculate shift duration
  const shiftDurationMs = signoutUtcDate.getTime() - signinUtcDate.getTime();
  const shiftDurationHours = Math.floor(shiftDurationMs / (1000 * 60 * 60));
  const shiftDurationMinutes = Math.floor((shiftDurationMs % (1000 * 60 * 60)) / (1000 * 60));
  console.log(`Shift duration: ${shiftDurationHours}h ${shiftDurationMinutes}m`);

} catch (error) {
  console.error('Test failed:', error);
}
