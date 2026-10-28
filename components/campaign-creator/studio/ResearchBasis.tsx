"use client"

import type { DirectionResearch } from "@/lib/campaign-creator/types"

function traceLine(trace: DirectionResearch["evidenceTrace"]): string {
  if (!trace) return ""
  return [
    trace.headlineId ? `Headline from ${trace.headlineId}` : "",
    trace.offerId ? `Offer from ${trace.offerId}` : "",
    trace.layoutId ? `Layout from ${trace.layoutId}` : "",
    trace.photoId ? `Photo from ${trace.photoId}` : "",
  ].filter(Boolean).join(" · ")
}

/**
 * Customer-facing citation for a direction.
 * Scores and repair notes stay off this component.
 */
export function ResearchBasis({ research }: { research?: DirectionResearch }) {
  if (!research?.sources?.length) return null

  return (
    <details
      className="text-[11px] leading-snug text-muted-foreground"
      data-research-basis=""
      onClick={(event) => event.stopPropagation()}
    >
      <summary className="cursor-pointer text-xs font-medium text-foreground/80">
        Based on research
      </summary>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {research.sources.map((source) => (
          <li key={source.mmrId}>
            <span className="font-medium text-foreground/80">{source.mmrId}</span>
            {" · "}
            {source.whyItWorks}
          </li>
        ))}
      </ul>
      {research.influencedBy && research.influencedBy.length > 0 ? (
        <p className="mt-1.5">Influenced by {research.influencedBy.join(", ")}</p>
      ) : null}
      {traceLine(research.evidenceTrace) ? <p className="mt-1.5">{traceLine(research.evidenceTrace)}</p> : null}
      {research.layoutSummary ? <p className="mt-1.5">{research.layoutSummary}</p> : null}
    </details>
  )
}
