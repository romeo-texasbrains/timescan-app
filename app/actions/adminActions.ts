'use server';

import { createClient } from '@supabase/supabase-js';
import { z, ZodIssue } from 'zod';
import { redirect } from 'next/navigation';
import { createClient as createServerClient } from '@/lib/supabase/server'; // For checking current admin status
import { loadEnvVariables } from "@/lib/environment";

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

export async function addEmployee(formData: unknown): Promise<ActionResult> {
    
    // --- ENVIRONMENT LOADING --- 
    console.log("--- LOADING ENVIRONMENT VARIABLES MANUALLY ---");
    const envLoadResult = loadEnvVariables();
    console.log("Environment loading result:", envLoadResult.success ? "SUCCESS" : "FAILED");
    
    if (!envLoadResult.success) {
        console.error("Failed to load environment variables");
        return { 
            success: false, 
            message: "Server configuration error: Could not load environment variables." 
        };
    }
    
    // Continue with original debugging
    console.log("--- COMPREHENSIVE ENVIRONMENT DEBUG ---");
    console.log("1. Direct access:");
    console.log("   SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "EXISTS (masked)" : "MISSING");
    console.log("   NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    
    console.log("2. Property check:");
    console.log("   'SUPABASE_SERVICE_ROLE_KEY' in process.env:", 'SUPABASE_SERVICE_ROLE_KEY' in process.env);
    console.log("   hasOwnProperty('SUPABASE_SERVICE_ROLE_KEY'):", process.env.hasOwnProperty('SUPABASE_SERVICE_ROLE_KEY'));
    
    console.log("3. Object.keys verification:");
    const envKeys = Object.keys(process.env).filter(key => 
        key.includes('SUPABASE') || key.includes('NEXT_PUBLIC')
    );
    console.log("   Environment keys related to Supabase:", envKeys);
    
    console.log("4. Full environment dump (keys only):");
    console.log("   All environment keys:", Object.keys(process.env));
    
    console.log("----------------------------------------");
    // --- END DEBUGGING ---
    
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
    let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
    
    // TEMPORARY FALLBACK - ONLY FOR TESTING, REMOVE THIS AFTER DEBUGGING!
    if (!serviceRoleKey) {
        console.log("WARNING: Using hardcoded fallback service role key for testing!");
        serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vZWNrbm1xa2VueHh1eWNsZ3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg0MTY5MiwiZXhwIjoyMDYxNDE3NjkyfQ.yjr2SCeuZzPAqKKPBeh9s-7sZb2_jNINi7fRC0TnWfA";
    }

    // Check environment variables
    if (!supabaseUrl || !serviceRoleKey) {
        console.error("Server Error: Missing Supabase URL or Service Role Key.");
        return { success: false, message: "Server configuration error." };
    }

    // --- Revert Debugging (Optional, can be removed later) --- 
    console.log("--- Server Action Environment Debug ---");
    console.log("process.env.SUPABASE_SERVICE_ROLE_KEY raw:", 
                 serviceRoleKey ? 
                 serviceRoleKey.substring(0, 5) + '...' : 
                 '<< MISSING/UNDEFINED >>'
                );
    console.log("process.env.NEXT_PUBLIC_SUPABASE_URL raw:", supabaseUrl);
    console.log("Does process.env have SUPABASE_SERVICE_ROLE_KEY?", process.env.hasOwnProperty('SUPABASE_SERVICE_ROLE_KEY'));
    console.log("-------------------------------------");
    // --- END DEBUGGING ---

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
        // Optional: Update profile role immediately if trigger doesn't use metadata
        // This requires the `id` from `newUser.user.id`
        if (newUser?.user) {
            const { error: updateProfileError } = await supabaseAdmin
                .from('profiles')
                .update({ role: role }) // Explicitly set role from form
                .eq('id', newUser.user.id);

            if (updateProfileError) {
                console.warn(`User ${email} created, but failed to update role in profile: ${updateProfileError.message}`);
                // Decide if this is critical - maybe return success with warning?
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