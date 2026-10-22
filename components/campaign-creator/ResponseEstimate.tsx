import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { estimateResponse } from "@/lib/response-estimates/estimate"

interface ResponseEstimateProps {
  brief: CampaignBrief
}

/**
 * A planning range shown before someone orders mail.
 * The wording is an estimate. It is never a promised result.
 */
export function ResponseEstimate({ brief }: ResponseEstimateProps) {
  const estimate = estimateResponse(brief)

  return (
    <section
      aria-label="Expected response"
      data-testid="response-estimate"
      className="flex flex-col gap-1 rounded-xl bg-muted/40 px-3 py-3"
    >
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Estimate</p>
      <p className="text-sm font-medium">{estimate.headline}</p>
      <p className="text-sm text-muted-foreground">{estimate.quantityNote}</p>
      <p className="text-sm text-muted-foreground">{estimate.why}</p>
      <p className="text-xs text-muted-foreground">{estimate.disclaimer}</p>
    </section>
  )
}
