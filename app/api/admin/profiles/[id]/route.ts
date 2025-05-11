import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const awaitedParams = await params;
  const { id } = awaitedParams;

  // Check if user is admin
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized: Please log in' },
      { status: 401 }
    );
  }

  // Get user role
  const { data: userRoles, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  if (roleError || !userRoles || !userRoles.length) {
    return NextResponse.json(
      { error: 'Unauthorized: Role not found' },
      { status: 401 }
    );
  }

  const isAdmin = userRoles.some(ur => ur.role === 'admin');

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Unauthorized: Admin access required' },
      { status: 403 }
    );
  }

  // Get form data
  const formData = await request.formData();

  // Extract profile data
  const profileData: Record<string, any> = {
    full_name: formData.get('full_name'),
    phone_number: formData.get('phone_number'),
    address: formData.get('address'),
    date_of_birth: formData.get('date_of_birth'),
    emergency_contact_name: formData.get('emergency_contact_name'),
    emergency_contact_relationship: formData.get('emergency_contact_relationship'),
    emergency_contact_phone: formData.get('emergency_contact_phone'),
    role: formData.get('role'),
  };

  // Handle department_id (can be 'none' which should be converted to null)
  const departmentId = formData.get('department_id');
  if (departmentId !== null) {
    profileData.department_id = departmentId === 'none' ? null : departmentId;
  }

  // Remove any undefined or null values
  Object.keys(profileData).forEach(key => {
    if (profileData[key] === null || profileData[key] === undefined) {
      delete profileData[key];
    }
  });

  // Get the role from the form data
  const role = formData.get('role') as string;

  // Remove role from profileData as it's not a column in the profiles table
  delete profileData.role;

  // Start a transaction to update both the profile and user_roles
  const { error: updateError } = await supabase
    .from('profiles')
    .update(profileData)
    .eq('id', id);

  if (updateError) {
    console.error('Error updating profile:', updateError);
    return NextResponse.json(
      { error: `Failed to update profile: ${updateError.message}` },
      { status: 500 }
    );
  }

  // Update the user_roles table if a role was provided
  if (role) {
    // First, check if a role entry exists
    const { data: existingRole, error: roleCheckError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', id)
      .single();

    if (roleCheckError && roleCheckError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error checking existing role:', roleCheckError);
      return NextResponse.json(
        { error: `Failed to check existing role: ${roleCheckError.message}` },
        { status: 500 }
      );
    }

    if (existingRole) {
      // Update existing role
      const { error: roleUpdateError } = await supabase
        .from('user_roles')
        .update({ role })
        .eq('user_id', id);

      if (roleUpdateError) {
        console.error('Error updating role:', roleUpdateError);
        return NextResponse.json(
          { error: `Failed to update role: ${roleUpdateError.message}` },
          { status: 500 }
        );
      }
    } else {
      // Insert new role
      const { error: roleInsertError } = await supabase
        .from('user_roles')
        .insert({ user_id: id, role, department_id: profileData.department_id });

      if (roleInsertError) {
        console.error('Error inserting role:', roleInsertError);
        return NextResponse.json(
          { error: `Failed to insert role: ${roleInsertError.message}` },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ success: true });
}
