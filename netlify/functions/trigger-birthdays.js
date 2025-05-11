// netlify/functions/trigger-birthdays.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
  // Check for authorization
  const authHeader = event.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
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

    // Get today's birthdays
    const today = new Date();
    const month = today.getMonth();  // JavaScript months are 0-indexed
    const day = today.getDate();

    // Get all profiles with date_of_birth not null
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .not('date_of_birth', 'is', null);

    if (profilesError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Error fetching profiles', details: profilesError })
      };
    }

    // Filter profiles with birthdays today in JavaScript
    // This avoids SQL type issues with date comparisons
    const birthdays = (profiles || []).filter(profile => {
      if (!profile.date_of_birth) return false;

      const dob = new Date(profile.date_of_birth);
      return dob.getMonth() === month && dob.getDate() === day;
    });

    const birthdaysError = null;

    if (birthdaysError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Error fetching birthdays', details: birthdaysError })
      };
    }

    if (!birthdays || birthdays.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No birthdays today' })
      };
    }

    // Get all push subscriptions
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (subscriptionsError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Error fetching subscriptions', details: subscriptionsError })
      };
    }

    if (!subscriptions || subscriptions.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No push subscriptions found' })
      };
    }

    // For each birthday, send notifications
    // In a real implementation, you would use web-push library here
    // This is a simplified version
    const results = birthdays.map(birthday => ({
      name: birthday.full_name,
      subscriptions: subscriptions.length
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Found ${birthdays.length} birthdays today and ${subscriptions.length} subscriptions`,
        results
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};