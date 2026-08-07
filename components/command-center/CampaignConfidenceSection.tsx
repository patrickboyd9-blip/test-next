import { AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CampaignConfidence, ConfidenceLevel } from "@/lib/command-center/types"

const CONFIDENCE_COPY: Record<
  ConfidenceLevel,
  { label: string; icon: typeof CheckCircle2; accent: string; card: string }
> = {
  on_track: {
    label: "On Track",
    icon: CheckCircle2,
    accent: "text-emerald-600 dark:text-emerald-400",
    card: "border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-card",
  },
  needs_attention: {
    label: "Needs Attention",
    icon: AlertTriangle,
    accent: "text-amber-600 dark:text-amber-400",
    card: "border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-card to-card",
  },
  at_risk: {
    label: "At Risk",
    icon: AlertOctagon,
    accent: "text-destructive",
    card: "border-destructive/20 bg-gradient-to-br from-destructive/10 via-card to-card",
  },
}

export function CampaignConfidenceSection({ confidence }: { confidence: CampaignConfidence }) {
  const copy = CONFIDENCE_COPY[confidence.level]
  const Icon = copy.icon

  return (
    <div className={cn("rounded-xl border p-6 shadow-sm", copy.card)}>
      <div className="flex gap-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full bg-background",
            copy.accent
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <span className={cn("text-xs font-semibold uppercase tracking-wide", copy.accent)}>
            Campaign Confidence · {copy.label}
          </span>
          <h2 className="text-lg font-semibold tracking-tight">{confidence.headline}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{confidence.evidence}</p>
          <p className="text-xs text-muted-foreground">
            Tracking your Primary Success Metric:{" "}
            <span className="font-medium text-foreground">{confidence.primaryMetricLabel}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
