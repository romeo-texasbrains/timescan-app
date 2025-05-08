import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// Manager section layout - adds authorization check for manager role
export default async function ManagerLayout({
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
  
  // Check if the user has manager or admin role by querying the profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()
  
  // If there's an error or user is not a manager or admin, redirect to home
  if (profileError || (profile?.role !== 'manager' && profile?.role !== 'admin')) {
    redirect('/')
  }
  
  return (
    <div className="w-full">
      {children}
    </div>
  )
}
