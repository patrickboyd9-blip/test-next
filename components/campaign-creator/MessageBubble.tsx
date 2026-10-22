import { cn } from "@/lib/utils"
import type { AudienceDefinition, CampaignBrief, ConversationMessage } from "@/lib/campaign-creator/types"

import { AudienceCard } from "./AudienceCard"
import { ResponseEstimate } from "./ResponseEstimate"

interface MessageBubbleProps {
  message: ConversationMessage
  audience?: AudienceDefinition
  brief?: CampaignBrief
  editableAudience?: boolean
  onAudienceChange?: (draft: AudienceDefinition) => void
  onOpenRoutes?: () => void
  routesBusy?: boolean
}

export function MessageBubble({
  message,
  audience,
  brief,
  editableAudience = false,
  onAudienceChange,
  onOpenRoutes,
  routesBusy,
}: MessageBubbleProps) {
  if (message.role === "system") {
    return (
      <p className="mx-auto max-w-md text-center text-xs text-muted-foreground">
        {message.content}
      </p>
    )
  }

  const isCustomer = message.role === "customer"
  const estimateBrief = brief && audience ? { ...brief, audience } : brief

  return (
    <div className={cn("flex", isCustomer ? "justify-end" : "justify-start")}>
      <div className={cn("flex max-w-[85%] flex-col gap-2", isCustomer && "items-end")}>
        <div
          className={cn(
            "rounded-xl px-3.5 py-2 text-sm whitespace-pre-wrap",
            isCustomer
              ? "bg-primary text-primary-foreground"
              : "bg-card text-card-foreground ring-1 ring-foreground/10"
          )}
        >
          {message.content}
        </div>
        {audience ? (
          <AudienceCard
            audience={audience}
            editable={editableAudience}
            onChange={onAudienceChange}
            onOpenRoutes={onOpenRoutes}
            routesBusy={routesBusy}
          />
        ) : null}
        {editableAudience && estimateBrief ? <ResponseEstimate brief={estimateBrief} /> : null}
      </div>
    </div>
  )
}
