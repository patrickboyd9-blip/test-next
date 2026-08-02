import { Badge } from "@/components/ui/badge"
import type { BusinessHealthStatus } from "@/lib/command-center/types"

const HEALTH_COPY: Record<BusinessHealthStatus, { label: string; className: string }> = {
  healthy: {
    label: "Healthy",
    className: "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  needs_attention: {
    label: "Needs Attention",
    className: "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  action_recommended: {
    label: "Action Recommended",
    className: "border-transparent bg-destructive/10 text-destructive",
  },
}

export function BusinessHealthBadge({ status }: { status: BusinessHealthStatus }) {
  const copy = HEALTH_COPY[status]
  return (
    <Badge variant="outline" className={copy.className}>
      {copy.label}
    </Badge>
  )
}
