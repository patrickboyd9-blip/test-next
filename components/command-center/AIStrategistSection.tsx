import { CometMark } from "@/components/assistant/CometMark"
import { ASSISTANT_NAME } from "@/lib/assistant/comet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RecommendationCard } from "./RecommendationCard"
import type { Recommendation } from "@/lib/command-center/types"

interface AIStrategistSectionProps {
  recommendations: Recommendation[]
}

export function AIStrategistSection({ recommendations }: AIStrategistSectionProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CometMark className="size-4" />
          {ASSISTANT_NAME}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {recommendations.length > 0 ? (
          recommendations.map((recommendation) => (
            <RecommendationCard key={recommendation.id} recommendation={recommendation} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No recommendations right now — check back after your next campaign update.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
