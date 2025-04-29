'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error logging out:', error)
      // Optionally display an error message to the user
    } else {
      // Redirect to login page after successful logout
      router.push('/login')
      // You might want to refresh to ensure session state is fully cleared client-side if needed
      // router.refresh()
    }
  }

  return (
    <button
      onClick={handleLogout}
      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
    >
      Logout
    </button>
  )
}
