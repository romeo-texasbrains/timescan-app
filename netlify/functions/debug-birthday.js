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
    const month = today.getMonth(); // JavaScript months are 0-indexed
    const day = today.getDate();

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
          env: envVars
        })
      };
    }

    // Filter profiles with birthdays today in JavaScript
    const birthdays = (profiles || []).filter(profile => {
      if (!profile.date_of_birth) return false;

      const dob = new Date(profile.date_of_birth);
      return dob.getMonth() === month && dob.getDate() === day;
    });

    const birthdaysError = null;

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Debug information',
        today: today.toISOString(),
        month,
        day,
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
