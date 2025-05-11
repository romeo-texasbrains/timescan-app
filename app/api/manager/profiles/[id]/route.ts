import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const awaitedParams = await params;
  const { id } = awaitedParams;

  // Check if user is logged in
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized: Please log in' },
      { status: 401 }
    );
  }

  // Get user role and department
  const { data: userRoles, error: roleError } = await supabase
    .from('user_roles')
    .select('role, department_id')
    .eq('user_id', user.id);

  if (roleError || !userRoles || !userRoles.length) {
    return NextResponse.json(
      { error: 'Unauthorized: Role not found' },
      { status: 401 }
    );
  }

  const isManager = userRoles.some(ur => ur.role === 'manager');
  const isAdmin = userRoles.some(ur => ur.role === 'admin');

  if (!isManager && !isAdmin) {
    return NextResponse.json(
      { error: 'Unauthorized: Manager or admin access required' },
      { status: 403 }
    );
  }

  // Get the manager's department ID
  const managerDepartmentId = userRoles.find(ur => ur.role === 'manager')?.department_id;

  // For managers, check if the profile belongs to their department
  if (isManager && !isAdmin) {
    // Get the profile's department
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('department_id')
      .eq('id', id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'Error fetching profile' },
        { status: 500 }
      );
    }

    // Check if the profile belongs to the manager's department
    if (profile.department_id !== managerDepartmentId) {
      return NextResponse.json(
        { error: 'Unauthorized: You can only edit profiles in your department' },
        { status: 403 }
      );
    }
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
  };

  // Handle department_id if it's present (for admin users)
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

  // Update the profile
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

  return NextResponse.json({ success: true });
}
