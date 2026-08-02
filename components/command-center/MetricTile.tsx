import { AnimatedNumber } from "./AnimatedNumber"
import type { BusinessMetric } from "@/lib/command-center/types"

export function MetricTile({ metric }: { metric: BusinessMetric }) {
  const hasChange = typeof metric.changePercent === "number"
  const isPositive = hasChange && (metric.changePercent as number) >= 0

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <span className="text-xs text-muted-foreground">{metric.label}</span>
      <span className="text-xl font-semibold tabular-nums">
        <AnimatedNumber value={metric.value} />
        {metric.unit && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">{metric.unit}</span>
        )}
      </span>
      {hasChange && (
        <span
          className={
            isPositive
              ? "text-xs font-medium text-emerald-600 dark:text-emerald-400"
              : "text-xs font-medium text-destructive"
          }
        >
          {isPositive ? "+" : ""}
          {metric.changePercent}% vs. last 30 days
        </span>
      )}
    </div>
  )
}
