import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// Admin section layout - adds authorization check for admin role
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get supabase client
  const supabase = await createClient()
  
  // Get user and check if they're logged in
  const { data, error } = await supabase.auth.getUser()
  
  if (error || !data?.user) {
    redirect('/login')
  }
  
  // Check if the user has admin role by querying the profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()
  
  // If there's an error or user is not an admin, redirect to home
  if (profileError || profile?.role !== 'admin') {
    redirect('/')
  }
  
  return (
    <div className="admin-section">
      <div className="bg-gray-100 dark:bg-gray-900 p-3 mb-4 rounded-md">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Admin Area</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          You have administrative access to manage all attendance records
        </p>
      </div>
      {children}
    </div>
  )
}
