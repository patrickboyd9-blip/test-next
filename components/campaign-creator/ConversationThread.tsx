import type { AudienceDefinition, CampaignBrief, ConversationMessage } from "@/lib/campaign-creator/types"

import { MessageBubble } from "./MessageBubble"

interface ConversationThreadProps {
  messages: ConversationMessage[]
  isThinking: boolean
  brief?: CampaignBrief
  onAudienceChange?: (draft: AudienceDefinition) => void
  onOpenRoutes?: () => void
  routesBusy?: boolean
}

export function ConversationThread({
  messages,
  isThinking,
  brief,
  onAudienceChange,
  onOpenRoutes,
  routesBusy,
}: ConversationThreadProps) {
  const latestCardIndex = messages.reduce(
    (found, message, index) => (message.audienceCard ? index : found),
    -1
  )

  return (
    <div className="flex flex-col gap-3">
      {messages.map((message, index) => {
        const isLatestCard = index === latestCardIndex
        const audience = message.audienceCard
          ? isLatestCard
            ? brief?.audience ?? message.audienceCard
            : message.audienceCard
          : undefined
        return (
          <MessageBubble
            key={message.id}
            message={message}
            audience={audience}
            brief={brief}
            editableAudience={isLatestCard}
            onAudienceChange={onAudienceChange}
            onOpenRoutes={onOpenRoutes}
            routesBusy={routesBusy}
          />
        )
      })}
      {isThinking && (
        <div className="flex justify-start">
          <div className="rounded-xl bg-card px-3.5 py-2 text-sm text-muted-foreground ring-1 ring-foreground/10">
            Modern Mail is thinking…
          </div>
        </div>
      )}
    </div>
  )
}
