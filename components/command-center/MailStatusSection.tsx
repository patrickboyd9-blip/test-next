import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AnimatedNumber } from "./AnimatedNumber"
import type { MailStatusSummary } from "@/lib/command-center/types"

interface MailStatusSectionProps {
  mailStatus: MailStatusSummary
}

export function MailStatusSection({ mailStatus }: MailStatusSectionProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Mail Status</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-semibold tabular-nums">
              <AnimatedNumber value={mailStatus.delivered} />
            </span>
            <span className="text-xs text-muted-foreground">Delivered</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-semibold tabular-nums">
              <AnimatedNumber value={mailStatus.inTransit} />
            </span>
            <span className="text-xs text-muted-foreground">In Transit</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-semibold tabular-nums">
              <AnimatedNumber value={mailStatus.scheduled} />
            </span>
            <span className="text-xs text-muted-foreground">Scheduled</span>
          </div>
        </div>
        <div className="rounded-lg bg-muted/50 px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">Next Delivery</span>
          {mailStatus.nextDelivery ? (
            <p className="mt-1 text-sm">
              <span className="font-medium">{mailStatus.nextDelivery.date}</span>
              {" — "}
              {mailStatus.nextDelivery.label}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Nothing scheduled yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
