"use client"

import type { DirectionResearch } from "@/lib/campaign-creator/types"

/**
 * Customer-facing citation for a direction.
 * Scores and repair notes stay off this component.
 */
export function ResearchBasis({ research }: { research?: DirectionResearch }) {
  if (!research?.sources?.length) return null

  return (
    <details
      open
      className="text-[11px] leading-snug text-muted-foreground"
      data-research-basis=""
      onClick={(event) => event.stopPropagation()}
    >
      <summary className="cursor-pointer text-xs font-medium text-foreground/80">
        Based on research
      </summary>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {research.sources.map((source) => {
          const line = source.whyItWorks.startsWith(source.title)
            ? source.whyItWorks
            : source.title
          return (
            <li key={source.mmrId}>
              <span className="font-medium text-foreground/80">{source.mmrId}</span>
              {" · "}
              {line}
            </li>
          )
        })}
      </ul>
      {research.layoutSummary ? <p className="mt-1.5">{research.layoutSummary}</p> : null}
    </details>
  )
}
