'use server';

import { createClient } from '@supabase/supabase-js';
import { z, ZodIssue } from 'zod';
import { redirect } from 'next/navigation';
import { createClient as createServerClient } from '@/lib/supabase/server'; // For checking current admin status
import { loadEnvVariables } from "@/lib/environment";
import { revalidatePath } from 'next/cache';

// Input validation schema
const AddEmployeeSchema = z.object({
  fullName: z.string().min(1, { message: "Full name is required." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters long." }),
  role: z.enum(['employee', 'manager', 'admin'], { message: "Invalid role specified." }),
});

// Define return type for better type safety
type ActionResult = {
  success: boolean;
  message?: string;
};

// Department validation schemas
const DepartmentSchema = z.object({
  name: z.string().min(1, { message: "Department name is required." }),
  description: z.string().optional(),
  shift_start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: "Shift start time must be in HH:MM or HH:MM:SS format."
  }),
  shift_end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: "Shift end time must be in HH:MM or HH:MM:SS format."
  }),
  grace_period_minutes: z.coerce.number().int().min(0).max(60).default(30),
});

const UpdateDepartmentSchema = z.object({
  id: z.string().uuid({ message: "Invalid department ID." }),
  name: z.string().min(1, { message: "Department name is required." }),
  description: z.string().optional(),
  shift_start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: "Shift start time must be in HH:MM or HH:MM:SS format."
  }),
  shift_end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: "Shift end time must be in HH:MM or HH:MM:SS format."
  }),
  grace_period_minutes: z.coerce.number().int().min(0).max(60).default(30),
});

export async function addEmployee(formData: unknown): Promise<ActionResult> {

    // Load environment variables
    const envLoadResult = loadEnvVariables();

    if (!envLoadResult.success) {
        console.error("Failed to load environment variables");
        return {
            success: false,
            message: "Server configuration error: Could not load environment variables."
        };
    }

    const supabaseServer = await createServerClient(); // Use server client to check admin role

    // 1. Check if current user is admin (important security check)
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
    if (authError || !user) {
        return { success: false, message: "Unauthorized: Could not verify user." };
    }
    const { data: profile, error: profileError } = await supabaseServer
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError || profile?.role !== 'admin') {
        return { success: false, message: "Unauthorized: Only admins can add employees." };
    }

    // 2. Validate input using Zod
    const validatedFields = AddEmployeeSchema.safeParse(formData);
    if (!validatedFields.success) {
        // Explicitly type 'e' as ZodIssue
        const errorMessage = validatedFields.error.errors.map((e: ZodIssue) => e.message).join(', ');
        return { success: false, message: errorMessage };
    }

    const { fullName, email, password, role } = validatedFields.data;

    // 3. Create Supabase Admin Client using Service Role Key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Check environment variables
    if (!supabaseUrl || !serviceRoleKey) {
        console.error("Server Error: Missing Supabase URL or Service Role Key.");
        return {
            success: false,
            message: "Server configuration error: Missing required environment variables."
        };
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            // Required for admin actions
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // 4. Create the user using the Admin API
    try {
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // Auto-confirm email since admin is creating
            user_metadata: {
                full_name: fullName,
                role: role, // Pass role in metadata - trigger needs adjustment to use this
            },
        });

        if (createError) {
            console.error("Supabase Create User Error:", createError);
            // Provide more specific messages based on common Supabase errors
            if (createError.message.includes("already registered")) {
                return { success: false, message: "Email address is already registered." };
            }
            if (createError.message.includes("Password should be at least 6 characters")) {
                 // Note: Zod already checks for 8, but Supabase might have its own minimum
                return { success: false, message: "Password is too short (Supabase requirement)." };
            }
            return { success: false, message: `Failed to create user: ${createError.message}` };
        }

        // User created successfully in auth.users.
        // The trigger `handle_new_user` should have created the profile.
        // Update profile role and ensure user_roles entry exists
        if (newUser?.user) {
            // 1. Update the profile with the role
            const { error: updateProfileError } = await supabaseAdmin
                .from('profiles')
                .update({ role: role }) // Explicitly set role from form
                .eq('id', newUser.user.id);

            if (updateProfileError) {
                console.warn(`User ${email} created, but failed to update role in profile: ${updateProfileError.message}`);
            }

            // 2. Check if user_roles table exists and create entry
            try {
                // First check if the user already has an entry in user_roles
                const { data: existingUserRole, error: checkError } = await supabaseAdmin
                    .from('user_roles')
                    .select('user_id')
                    .eq('user_id', newUser.user.id)
                    .maybeSingle();

                if (checkError) {
                    console.warn(`Error checking user_roles for ${email}: ${checkError.message}`);
                }

                // If no entry exists, create one
                if (!existingUserRole) {
                    // Get department_id from profile
                    const { data: profileData, error: profileFetchError } = await supabaseAdmin
                        .from('profiles')
                        .select('department_id')
                        .eq('id', newUser.user.id)
                        .single();

                    if (profileFetchError) {
                        console.warn(`Error fetching profile for ${email}: ${profileFetchError.message}`);
                    }

                    // Insert into user_roles
                    const { error: insertError } = await supabaseAdmin
                        .from('user_roles')
                        .insert({
                            user_id: newUser.user.id,
                            role: role,
                            department_id: profileData?.department_id || null
                        });

                    if (insertError) {
                        console.warn(`Error creating user_roles entry for ${email}: ${insertError.message}`);
                    } else {
                        console.log(`Successfully created user_roles entry for ${email}`);
                    }
                } else {
                    // Update existing user_role
                    const { error: updateError } = await supabaseAdmin
                        .from('user_roles')
                        .update({
                            role: role,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', newUser.user.id);

                    if (updateError) {
                        console.warn(`Error updating user_roles for ${email}: ${updateError.message}`);
                    } else {
                        console.log(`Successfully updated user_roles for ${email}`);
                    }
                }
            } catch (error) {
                console.warn(`Unexpected error handling user_roles for ${email}:`, error);
            }
        } else {
             console.warn(`User ${email} created, but newUser object was not returned as expected.`);
        }


        // 5. Redirect on success (use after successful creation)
        // Note: redirect() must be called outside try/catch
        // Revalidate path?
        // revalidatePath('/admin/employees');

    } catch (error: unknown) {
        console.error("Unexpected Error in addEmployee action:", error);
        return { success: false, message: "An unexpected server error occurred." };
    }

    // Must be called outside try/catch
    redirect('/admin/employees');
    // Redirect technically stops execution, so return below is unlikely reached
    // return { success: true, message: "Employee added successfully!" };
}

// Create a new department
export async function createDepartment(formData: FormData) {
  const supabase = await createServerClient();

  // Check if user is admin
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    redirect('/');
  }

  // Parse and validate form data
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const shift_start_time = formData.get('shift_start_time') as string;
  const shift_end_time = formData.get('shift_end_time') as string;
  const grace_period_minutes = formData.get('grace_period_minutes') as string;

  const validatedFields = DepartmentSchema.safeParse({
    name,
    description,
    shift_start_time,
    shift_end_time,
    grace_period_minutes: parseInt(grace_period_minutes)
  });

  if (!validatedFields.success) {
    // In a real app, you'd want to return these errors to the form
    console.error("Validation error:", validatedFields.error.errors);
    redirect('/admin/departments?error=Invalid form data');
  }

  // Create department
  const { error } = await supabase
    .from('departments')
    .insert({
      name,
      description: description || null,
      shift_start_time,
      shift_end_time,
      grace_period_minutes: parseInt(grace_period_minutes),
    });

  if (error) {
    console.error("Error creating department:", error);
    redirect('/admin/departments?error=Failed to create department');
  }

  revalidatePath('/admin/departments');
  redirect('/admin/departments?success=Department created successfully');
}

// Update an existing department
export async function updateDepartment(formData: FormData) {
  const supabase = await createServerClient();

  // Check if user is admin
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    redirect('/');
  }

  // Parse and validate form data
  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const shift_start_time = formData.get('shift_start_time') as string;
  const shift_end_time = formData.get('shift_end_time') as string;
  const grace_period_minutes = formData.get('grace_period_minutes') as string;

  const validatedFields = UpdateDepartmentSchema.safeParse({
    id,
    name,
    description,
    shift_start_time,
    shift_end_time,
    grace_period_minutes: parseInt(grace_period_minutes)
  });

  if (!validatedFields.success) {
    console.error("Validation error:", validatedFields.error.errors);
    redirect(`/admin/departments/${id}?error=Invalid form data`);
  }

  // Update department
  const { error } = await supabase
    .from('departments')
    .update({
      name,
      description: description || null,
      shift_start_time,
      shift_end_time,
      grace_period_minutes: parseInt(grace_period_minutes),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error("Error updating department:", error);
    redirect(`/admin/departments/${id}?error=Failed to update department`);
  }

  revalidatePath('/admin/departments');
  revalidatePath(`/admin/departments/${id}`);
  redirect('/admin/departments?success=Department updated successfully');
}

// Delete a department
export async function deleteDepartment(formData: FormData) {
  const supabase = await createServerClient();

  // Check if user is admin
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    redirect('/');
  }

  // Get department ID
  const id = formData.get('id') as string;

  // Check if department has employees
  const { count, error: countError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('department_id', id);

  if (countError) {
    console.error("Error checking department employees:", countError);
    redirect('/admin/departments?error=Failed to check department employees');
  }

  if (count && count > 0) {
    redirect('/admin/departments?error=Cannot delete department with employees. Please reassign employees first.');
  }

  // Delete department
  const { error: deleteError } = await supabase
    .from('departments')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error("Error deleting department:", deleteError);
    redirect('/admin/departments?error=Failed to delete department');
  }

  revalidatePath('/admin/departments');
  redirect('/admin/departments?success=Department deleted successfully');
}