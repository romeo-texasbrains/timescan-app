import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getAppSettings } from '@/lib/db/queries';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/api-helpers';
import { createClient } from '@/lib/supabase/server';

/**
 * GET handler for the timezone API
 * Returns the current timezone setting
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getAuthenticatedUser();

    if (!session) {
      return createErrorResponse('Unauthorized', 401);
    }

    // Fetch app settings
    const settings = await getAppSettings();

    const response = createSuccessResponse({
      timezone: settings.timezone || 'UTC'
    });

    // Add caching headers (cache for 5 minutes)
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    response.headers.set('Vary', 'Authorization');

    return response;

  } catch (error) {
    console.error('Timezone API error:', error);
    // For backward compatibility, return UTC on error
    return NextResponse.json({ timezone: 'UTC' });
  }
}

/**
 * PUT handler for updating timezone
 * Only admins can update timezone
 */
export async function PUT(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getAuthenticatedUser();

    if (!session) {
      return createErrorResponse('Unauthorized', 401);
    }

    // Only admins can update timezone
    if (session.role !== 'admin') {
      return createErrorResponse('Forbidden: Only admins can update timezone', 403);
    }

    // Parse request body
    const body = await request.json();

    // Validate timezone
    if (!body.timezone || typeof body.timezone !== 'string') {
      return createErrorResponse('Invalid timezone value', 400);
    }

    const timezone = body.timezone.trim();

    // Validate timezone format
    try {
      // Test if the timezone is valid by trying to format a date with it
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    } catch (error) {
      return createErrorResponse(`Invalid timezone: ${timezone}`, 400);
    }

    // Get current settings
    const currentSettings = await getAppSettings();

    // Update timezone in database
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('app_settings')
      .update({
        timezone: timezone,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentSettings.id || 1)
      .select()
      .single();

    if (error) {
      console.error('Error updating timezone:', error);
      return createErrorResponse('Failed to update timezone', 500);
    }

    return createSuccessResponse({
      timezone: data.timezone
    }, {
      message: 'Timezone updated successfully'
    });

  } catch (error) {
    console.error('Timezone update API error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * POST handler for backward compatibility
 * Redirects to PUT method
 */
export async function POST(request: NextRequest) {
  return PUT(request);
}