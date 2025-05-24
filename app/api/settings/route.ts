import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getAppSettings } from '@/lib/db/queries';
import { getSearchParams, getQueryParam, createErrorResponse, createSuccessResponse } from '@/lib/utils/api-helpers';
import { createClient } from '@/lib/supabase/server';

/**
 * GET handler for the settings API
 * Returns application settings based on the user's role
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getAuthenticatedUser();
    
    if (!session) {
      return createErrorResponse('Unauthorized', 401);
    }
    
    // Get query parameters
    const searchParams = getSearchParams(request, 'http://localhost:3000/api/settings');
    const settingKey = getQueryParam(searchParams, 'key');
    
    // Fetch app settings
    const settings = await getAppSettings();
    
    // If a specific setting is requested, return just that
    if (settingKey) {
      if (settingKey === 'timezone') {
        return createSuccessResponse({
          timezone: settings.timezone || 'UTC',
          key: 'timezone'
        });
      }
      
      // Check if the requested setting exists
      if (settings.hasOwnProperty(settingKey)) {
        return createSuccessResponse({
          [settingKey]: settings[settingKey],
          key: settingKey
        });
      } else {
        return createErrorResponse(`Setting '${settingKey}' not found`, 404);
      }
    }
    
    // Return all settings (filtered based on role if needed)
    const publicSettings = {
      timezone: settings.timezone || 'UTC',
      app_name: settings.app_name || 'TimeScan',
      // Add other public settings here
    };
    
    // Admins get additional settings
    if (session.role === 'admin') {
      return createSuccessResponse({
        ...publicSettings,
        // Add admin-only settings here
        id: settings.id,
        created_at: settings.created_at,
        updated_at: settings.updated_at
      });
    }
    
    // Regular users get public settings only
    return createSuccessResponse(publicSettings);
    
  } catch (error) {
    console.error('Settings API error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * PUT handler for updating settings
 * Only admins can update settings
 */
export async function PUT(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getAuthenticatedUser();
    
    if (!session) {
      return createErrorResponse('Unauthorized', 401);
    }
    
    // Only admins can update settings
    if (session.role !== 'admin') {
      return createErrorResponse('Forbidden: Only admins can update settings', 403);
    }
    
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body || typeof body !== 'object') {
      return createErrorResponse('Invalid request body', 400);
    }
    
    // Get current settings
    const currentSettings = await getAppSettings();
    
    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    // Validate and add allowed fields
    const allowedFields = ['timezone', 'app_name'];
    
    for (const field of allowedFields) {
      if (body.hasOwnProperty(field)) {
        // Special validation for timezone
        if (field === 'timezone') {
          const timezone = body[field];
          if (typeof timezone !== 'string' || timezone.trim() === '') {
            return createErrorResponse('Invalid timezone value', 400);
          }
          
          // Basic timezone validation (you might want to add more comprehensive validation)
          try {
            // Test if the timezone is valid by trying to format a date with it
            new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
            updateData[field] = timezone.trim();
          } catch (error) {
            return createErrorResponse(`Invalid timezone: ${timezone}`, 400);
          }
        } else {
          updateData[field] = body[field];
        }
      }
    }
    
    // If no valid fields to update
    if (Object.keys(updateData).length === 1) { // Only updated_at
      return createErrorResponse('No valid fields to update', 400);
    }
    
    // Update settings in database
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('app_settings')
      .update(updateData)
      .eq('id', currentSettings.id || 1)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating settings:', error);
      return createErrorResponse('Failed to update settings', 500);
    }
    
    return createSuccessResponse(data, {
      message: 'Settings updated successfully',
      updatedFields: Object.keys(updateData).filter(key => key !== 'updated_at')
    });
    
  } catch (error) {
    console.error('Settings update API error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * POST handler for creating initial settings
 * Only used if no settings exist yet
 */
export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getAuthenticatedUser();
    
    if (!session) {
      return createErrorResponse('Unauthorized', 401);
    }
    
    // Only admins can create settings
    if (session.role !== 'admin') {
      return createErrorResponse('Forbidden: Only admins can create settings', 403);
    }
    
    // Check if settings already exist
    try {
      const existingSettings = await getAppSettings();
      if (existingSettings && existingSettings.id) {
        return createErrorResponse('Settings already exist. Use PUT to update.', 409);
      }
    } catch (error) {
      // Settings don't exist, continue with creation
    }
    
    // Parse request body
    const body = await request.json();
    
    // Create default settings
    const defaultSettings = {
      id: 1,
      timezone: body.timezone || 'UTC',
      app_name: body.app_name || 'TimeScan',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Validate timezone if provided
    if (body.timezone) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: body.timezone }).format(new Date());
      } catch (error) {
        return createErrorResponse(`Invalid timezone: ${body.timezone}`, 400);
      }
    }
    
    // Create settings in database
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('app_settings')
      .insert(defaultSettings)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating settings:', error);
      return createErrorResponse('Failed to create settings', 500);
    }
    
    return createSuccessResponse(data, {
      message: 'Settings created successfully'
    });
    
  } catch (error) {
    console.error('Settings creation API error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
