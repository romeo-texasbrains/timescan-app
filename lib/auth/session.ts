import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export type UserSession = {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  department_id?: string;
};

/**
 * Gets the authenticated user's session
 * @returns The user session or null if not authenticated
 */
export async function getAuthenticatedUser(): Promise<UserSession | null> {
  try {
    const supabase = await createClient();
    
    // Get user from Supabase auth
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.error('Authentication error:', error);
      return null;
    }
    
    // Get user profile with role information
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role, department_id, full_name')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return null;
    }
    
    // Return user session with role
    return {
      id: profile.id,
      email: profile.email || user.email || '',
      role: profile.role as 'admin' | 'manager' | 'employee',
      department_id: profile.department_id
    };
  } catch (error) {
    console.error('Error getting authenticated user:', error);
    return null;
  }
}

/**
 * Server-side middleware to require authentication
 * Redirects to login if user is not authenticated
 * @returns The authenticated user session
 */
export async function requireAuth(): Promise<UserSession> {
  const session = await getAuthenticatedUser();
  
  if (!session) {
    redirect('/login');
  }
  
  return session;
}

/**
 * Server-side middleware to require a specific role
 * Redirects to home with error message if user doesn't have the required role
 * @param requiredRoles Array of allowed roles
 * @returns The authenticated user session if they have the required role
 */
export async function requireRole(requiredRoles: ('admin' | 'manager' | 'employee')[]): Promise<UserSession> {
  const session = await requireAuth();
  
  if (!requiredRoles.includes(session.role)) {
    redirect('/?message=You do not have permission to access this page.');
  }
  
  return session;
}
