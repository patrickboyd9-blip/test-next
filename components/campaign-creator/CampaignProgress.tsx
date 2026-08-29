import { cn } from "@/lib/utils"
import {
  CAMPAIGN_PROGRESS_STEPS,
  getProgressStepStates,
  type ProgressStepState,
} from "@/lib/campaign-creator/campaign-status"
import type { CampaignStatus } from "@/lib/campaign-creator/types"

interface CampaignProgressProps {
  status: CampaignStatus
  className?: string
}

function stepStyles(state: ProgressStepState) {
  switch (state) {
    case "complete":
      return {
        dot: "bg-primary",
        label: "text-foreground font-medium",
        connector: "bg-primary/40",
      }
    case "active":
      return {
        dot: "bg-primary ring-4 ring-primary/20",
        label: "text-foreground font-semibold",
        connector: "bg-border",
      }
    case "upcoming":
      return {
        dot: "bg-muted-foreground/30",
        label: "text-muted-foreground",
        connector: "bg-border",
      }
  }
}

export function CampaignProgress({ status, className }: CampaignProgressProps) {
  const stepStates = getProgressStepStates(status)

  return (
    <nav
      aria-label="Campaign progress"
      className={cn("w-full", className)}
    >
      <ol className="flex items-center">
        {CAMPAIGN_PROGRESS_STEPS.map((step, index) => {
          const state = stepStates[step.id]
          const styles = stepStyles(state)
          const isLast = index === CAMPAIGN_PROGRESS_STEPS.length - 1

          return (
            <li
              key={step.id}
              className={cn("flex items-center", !isLast && "flex-1")}
              aria-current={state === "active" ? "step" : undefined}
            >
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn("size-2.5 shrink-0 rounded-full transition-all", styles.dot)}
                />
                <span className={cn("text-xs whitespace-nowrap", styles.label)}>
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn("mx-2 h-px flex-1 min-w-4", styles.connector)}
                  aria-hidden
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
