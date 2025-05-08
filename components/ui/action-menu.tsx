"use client"

import * as React from "react"
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"
import { SimpleDropdown, SimpleDropdownItem } from "./simple-dropdown"

export interface ActionItem {
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  href?: string
  disabled?: boolean
  variant?: 'default' | 'destructive'
  className?: string
}

interface ActionMenuProps {
  actions: ActionItem[]
  align?: "left" | "right"
  className?: string
  buttonClassName?: string
}

export function ActionMenu({
  actions,
  align = "right",
  className,
  buttonClassName
}: ActionMenuProps) {
  return (
    <SimpleDropdown
      align={align}
      trigger={
        <button
          type="button"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border border-border/50 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
            "active:scale-95 touch-manipulation",
            buttonClassName
          )}
        >
          <EllipsisVerticalIcon className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </button>
      }
      className={cn("w-48", className)}
    >
      {actions.map((action, index) => {
        if (action.href) {
          return (
            <SimpleDropdownItem
              key={index}
              asChild
              disabled={action.disabled}
              destructive={action.variant === "destructive"}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                action.className
              )}
            >
              <a
                href={action.href}
                className="flex items-center gap-2 w-full touch-manipulation"
                onClick={(e) => {
                  if (action.disabled) {
                    e.preventDefault()
                  }
                  action.onClick?.()
                }}
              >
                {action.icon}
                {action.label}
              </a>
            </SimpleDropdownItem>
          )
        }

        return (
          <SimpleDropdownItem
            key={index}
            onClick={action.onClick}
            disabled={action.disabled}
            destructive={action.variant === "destructive"}
            className={cn(
              "flex items-center gap-2 cursor-pointer",
              action.className
            )}
          >
            {action.icon}
            {action.label}
          </SimpleDropdownItem>
        )
      })}
    </SimpleDropdown>
  )
}
