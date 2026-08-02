import { MetricTile } from "./MetricTile"
import type { BusinessMetric } from "@/lib/command-center/types"

export function MetricsStrip({ metrics }: { metrics: BusinessMetric[] }) {
  if (metrics.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {metrics.map((metric) => (
        <MetricTile key={metric.id} metric={metric} />
      ))}
    </div>
  )
}
