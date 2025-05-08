'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import AnimatedBackground from '@/components/AnimatedBackground'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    toast.dismiss()

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast.error(`Login failed: ${error.message}`)
      } else {
        toast.success('Login successful! Redirecting...')
        router.push('/')
        router.refresh()
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false)
    }
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-background to-background/80 relative overflow-hidden">
      {/* Animated background with floating logos */}
      <AnimatedBackground spriteCount={35} />

      {/* Login card with backdrop blur for better readability over the animated background */}
      <div className="w-full max-w-md p-8 space-y-8 bg-card/80 rounded-xl shadow-2xl border border-border/30 backdrop-blur-md z-10 motion-safe:animate-fadeIn">
        <div className="flex flex-col items-center">
          <div className="relative h-16 w-40 mb-2">
            <Image
              src="/logo.png"
              alt="TimeScan Logo"
              fill
              sizes="(max-width: 768px) 20vw, 160px"
              className="object-contain"
              priority
            />
          </div>
          <h2 className="text-3xl font-bold text-center text-foreground mt-2">Welcome Back</h2>
          <p className="text-muted-foreground text-center mt-2">Sign in to access your account</p>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-4"></div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground"
            >
              Email address
            </label>
            <div className="relative">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border bg-input/50 border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-foreground transition-all duration-200"
                placeholder="your.email@example.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border bg-input/50 border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-foreground pr-12 transition-all duration-200"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full px-4 py-3 font-medium text-primary-foreground rounded-lg transition-all duration-200 ${
                isLoading
                  ? 'bg-primary/70 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/90 shadow-lg hover:shadow-primary/25'
              } focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </div>
        </form>

        <div className="text-center text-sm text-muted-foreground mt-6">
          <p>TimeScan - Secure Attendance Tracking</p>
        </div>
      </div>
    </div>
  )
}
