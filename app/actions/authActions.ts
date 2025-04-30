'use server'

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export async function logoutAction() {
  const cookieStore = cookies()
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Logout Error:', error);
    // Optionally redirect with an error message, but usually just redirecting to login is fine
    // return redirect('/login?message=Logout failed. Please try again.');
  }

  // Redirect to the login page after successful sign out
  return redirect('/login?message=Successfully logged out.');
} 