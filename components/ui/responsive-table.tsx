"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/useMediaQuery"

interface ResponsiveTableProps extends React.ComponentProps<"table"> {
  mobileCardMode?: boolean;
}

function ResponsiveTable({
  className,
  mobileCardMode = true,
  ...props
}: ResponsiveTableProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');

  return (
    <div
      data-slot="table-container"
      className={cn(
        "relative w-full",
        isMobile && mobileCardMode ? "overflow-visible" : "overflow-x-auto"
      )}
    >
      <table
        data-slot="table"
        data-mobile-mode={isMobile && mobileCardMode ? "true" : "false"}
        className={cn(
          "w-full caption-bottom text-sm",
          isMobile && mobileCardMode && "responsive-table",
          className
        )}
        {...props}
      />
    </div>
  )
}

function ResponsiveTableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  const isMobile = useMediaQuery('(max-width: 640px)');

  return (
    <thead
      data-slot="table-header"
      className={cn(
        "[&_tr]:border-b",
        isMobile && "sr-only",
        className
      )}
      {...props}
    />
  )
}

function ResponsiveTableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  const isMobile = useMediaQuery('(max-width: 640px)');

  return (
    <tbody
      data-slot="table-body"
      className={cn(
        "[&_tr:last-child]:border-0",
        isMobile && "block space-y-4",
        className
      )}
      {...props}
    />
  )
}

function ResponsiveTableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

interface ResponsiveTableRowProps extends React.ComponentProps<"tr"> {
  headers?: string[];
}

function ResponsiveTableRow({
  className,
  headers = [],
  ...props
}: ResponsiveTableRowProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');

  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        isMobile && "block rounded-lg border border-border/50 shadow-sm bg-card mb-6 overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function ResponsiveTableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-4 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

interface ResponsiveTableCellProps extends React.ComponentProps<"td"> {
  header?: string;
}

function ResponsiveTableCell({
  className,
  header,
  ...props
}: ResponsiveTableCellProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');

  return (
    <td
      data-slot="table-cell"
      data-header={header}
      className={cn(
        "p-4 align-middle",
        isMobile && "block relative pl-4 pr-4 py-3 border-b border-border/10 last:border-0 min-h-[3.5rem]",
        isMobile && header && header !== "Actions" && "pl-[6.5rem]",
        header === "Actions" && isMobile && "pl-4 text-right",
        className
      )}
      {...props}
    >
      {isMobile && header && header !== "Actions" && (
        <span className="absolute left-4 top-3 font-medium text-xs uppercase text-muted-foreground w-[5.5rem] truncate">
          {header}
        </span>
      )}
      <div className={cn(
        "w-full",
        header === "Actions" && isMobile && "flex justify-end"
      )}>
        {props.children}
      </div>
    </td>
  )
}

function ResponsiveTableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  ResponsiveTable,
  ResponsiveTableHeader,
  ResponsiveTableBody,
  ResponsiveTableFooter,
  ResponsiveTableHead,
  ResponsiveTableRow,
  ResponsiveTableCell,
  ResponsiveTableCaption,
}
