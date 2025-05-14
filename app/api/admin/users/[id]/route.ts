import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// Define deletion modes
type DeletionMode = 'account_only' | 'all_data';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const awaitedParams = await params;
  const { id: userIdToDelete } = awaitedParams;

  // Get the deletion mode from the request
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') as DeletionMode || 'account_only';

  // Check if user is admin
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized: Please log in' },
      { status: 401 }
    );
  }

  // Get user role
  const { data: adminProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || adminProfile?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Unauthorized: Only admins can delete users' },
      { status: 403 }
    );
  }

  // Prevent admins from deleting themselves
  if (userIdToDelete === user.id) {
    return NextResponse.json(
      { error: 'Cannot delete your own account' },
      { status: 400 }
    );
  }

  // Create admin client with service role key for auth operations
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  const supabaseAdmin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Use the SQL function to handle all data deletion in a transaction
    const { data, error: sqlError } = await supabase
      .rpc('delete_user_data', {
        user_id: userIdToDelete,
        delete_all_data: mode === 'all_data'
      });

    if (sqlError) {
      console.error('Error executing delete_user_data function:', sqlError);
      return NextResponse.json(
        { error: `Failed to delete user data: ${sqlError.message}` },
        { status: 500 }
      );
    }

    // Finally, delete the user from auth.users
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
      userIdToDelete
    );

    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError);
      return NextResponse.json(
        { error: `Failed to delete user account: ${authDeleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: mode === 'all_data'
        ? 'User and all associated data deleted successfully'
        : 'User account deleted, but attendance data preserved'
    });
  } catch (error) {
    console.error('Unexpected error during user deletion:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during user deletion' },
      { status: 500 }
    );
  }
}
