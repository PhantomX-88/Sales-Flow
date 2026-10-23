/* ------------------------------------------------------------------ */
/* Central CTA — consolidated call-to-action per dashboard page       */
/* ------------------------------------------------------------------ */

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { usePipeline } from "@/components/dashboard/pipeline-provider"

/**
 * Centralized CTA component that replaces scattered "New opportunity"/"Add a deal"
 * buttons across the dashboard.
 *
 * Renders a single primary action button that opens the opportunity creation dialog.
 * Accepts optional customization props for page-specific tailoring.
 */
export function CentralCTA({
  title = "New opportunity",
  icon = Plus,
  className,
  ...props
}: {
  title?: string
  icon?: React.ElementType
  className?: string
  /** Optional secondary action label + handler (e.g. "Import CSV") */
  secondaryAction?: {
    label: string
    onClick: () => void
    disabled?: boolean
  }
}) {
  const { openCreateDialog } = usePipeline()

  return (
    <Button
      size="sm"
      className={cn("h-9", className)}
      onClick={openCreateDialog}
      {...props}
    >
      <icon className="h-4 w-4" />
      {title}
    </Button>
  )
}