'use client'

import React from 'react'

interface ClientRootLayoutProps {
  children: React.ReactNode
  htmlClassName?: string
  bodyClassName: string
}

/**
 * A client component wrapper for the root layout to better handle hydration mismatches
 * caused by browser extensions that inject attributes.
 */
export default function ClientRootLayout({
  children,
  htmlClassName,
  bodyClassName,
}: ClientRootLayoutProps) {
  return (
    <html lang="en" className={htmlClassName} suppressHydrationWarning>
      <body className={bodyClassName} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
