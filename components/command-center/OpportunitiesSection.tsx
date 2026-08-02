import Link from "next/link"
import { Lightbulb } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Opportunity } from "@/lib/command-center/types"

export function OpportunitiesSection({ opportunities }: { opportunities: Opportunity[] }) {
  if (opportunities.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="size-4 text-primary" />
          Opportunities
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {opportunities.map((opportunity) => (
          <div
            key={opportunity.id}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
          >
            <h3 className="text-sm font-semibold">{opportunity.title}</h3>
            <p className="text-sm text-muted-foreground">{opportunity.description}</p>
            <Button
              size="sm"
              variant="outline"
              className="self-start"
              nativeButton={false}
              render={<Link href={opportunity.ctaHref} />}
            >
              {opportunity.ctaLabel}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
