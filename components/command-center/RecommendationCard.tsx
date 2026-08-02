import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { Recommendation } from "@/lib/command-center/types"

export function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">{recommendation.title}</h3>
        {recommendation.estimatedImpact && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {recommendation.estimatedImpact}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{recommendation.why}</p>
      <Button
        size="sm"
        className="self-start"
        nativeButton={false}
        render={<Link href={recommendation.ctaHref} />}
      >
        {recommendation.ctaLabel}
      </Button>
    </div>
  )
}
