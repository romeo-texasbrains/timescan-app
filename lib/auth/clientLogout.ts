import { createClient } from '@/lib/supabase/client';

/**
 * Client-side logout function that can be used as a fallback
 * when server-side logout fails
 */
export async function clientLogout() {
  try {
    // Create a client-side Supabase client
    const supabase = createClient();
    
    // Attempt to sign out using the client-side API
    await supabase.auth.signOut();
    
    // Return success
    return { success: true, error: null };
  } catch (error) {
    console.error('Client-side logout error:', error);
    
    // Return error
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during logout' 
    };
  }
}
