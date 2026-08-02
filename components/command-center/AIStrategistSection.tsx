import { Sparkles } from "lucide-react"
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
          <Sparkles className="size-4 text-primary" />
          AI Strategist
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
