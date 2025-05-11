// netlify/functions/debug-birthday.js
const { createClient } = require('@supabase/supabase-js');

// For debugging
console.log('Debug function loaded');

exports.handler = async function(event) {
  try {
    console.log('Debug function handler called');

    // Return environment variables (without values for security)
    const envVars = Object.keys(process.env).reduce((acc, key) => {
      acc[key] = key.includes('KEY') || key.includes('SECRET') ? '[REDACTED]' : 'Set';
      return acc;
    }, {});

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing Supabase credentials' })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date
    const today = new Date();
    const month = today.getMonth() + 1; // JavaScript months are 0-indexed
    const day = today.getDate();

    // Format month and day with leading zeros if needed
    const monthStr = month.toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');

    // Get all profiles with date_of_birth not null
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, date_of_birth')
      .not('date_of_birth', 'is', null)
      .limit(10);

    if (profilesError) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Error fetching profiles',
          details: profilesError,
          env: {
            url: supabaseUrl ? 'Set' : 'Not set',
            key: supabaseServiceKey ? 'Set' : 'Not set'
          }
        })
      };
    }

    // Try the birthday query
    const { data: birthdays, error: birthdaysError } = await supabase
      .from('profiles')
      .select('id, full_name, date_of_birth')
      .not('date_of_birth', 'is', null)
      .filter('date_of_birth::text', 'ilike', `%-${monthStr}-${dayStr}%`)
      .limit(10);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Debug information',
        today: today.toISOString(),
        month,
        day,
        monthStr,
        dayStr,
        pattern: `%-${monthStr}-${dayStr}%`,
        profiles: profiles || [],
        birthdays: birthdays || [],
        birthdaysError: birthdaysError,
        env: envVars,
        netlifyEnv: process.env.NETLIFY || 'Not set',
        nodeEnv: process.env.NODE_ENV || 'Not set'
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message,
        stack: error.stack
      })
    };
  }
};
