import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()

  // Although middleware handles redirection, an extra check here is good practice.
  // Redirects if fetch fails or no user found (shouldn't happen if middleware is correct)
  if (error || !data?.user) {
    console.error('Auth error in AppLayout:', error)
    redirect('/login')
  }
  
  // Fetch user profile to check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()
    
  // Pass the actual role, default to 'user' if profile/role is missing
  const userRole = profile?.role || 'user' 

  // --- Logout Server Action --- 
  const logout = async () => {
    'use server' // Mark as server action
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login') // Redirect to login after sign out
  }
  // ---------------------------

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
      {/* Sidebar */}
      <Sidebar 
        role={userRole as 'admin' | 'manager' | 'user'} 
        onLogout={logout} // Pass the server action
      />
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen">
        <Topbar userEmail={data.user.email || 'User'} />
        <main className="flex-1 p-6 md:p-10 transition-all duration-300">
          {children}
        </main>
      </div>
    </div>
  )
}
