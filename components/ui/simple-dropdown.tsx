"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SimpleDropdownProps {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: "left" | "right"
  className?: string
}

export function SimpleDropdown({
  trigger,
  children,
  align = "right",
  className
}: SimpleDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>

      {isOpen && (
        <div
          className={cn(
            "absolute mt-1 z-50 min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
            align === "right" ? "right-0" : "left-0",
            className
          )}
          onClick={() => setIsOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  )
}

interface SimpleDropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string
  disabled?: boolean
  destructive?: boolean
  asChild?: boolean
}

export function SimpleDropdownItem({
  className,
  children,
  disabled,
  destructive,
  asChild,
  ...props
}: SimpleDropdownItemProps) {
  if (asChild) {
    return (
      <div
        className={cn(
          "relative flex w-full cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none transition-colors hover:bg-muted/50 active:bg-muted/70",
          destructive && "text-destructive hover:bg-destructive/10",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          className
        )}
      >
        {children}
      </div>
    )
  }

  return (
    <button
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none transition-colors hover:bg-muted/50 active:bg-muted/70",
        destructive && "text-destructive hover:bg-destructive/10",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

export function SimpleDropdownSeparator({ className }: { className?: string }) {
  return (
    <div className={cn("-mx-1 my-1 h-px bg-muted", className)} />
  )
}
