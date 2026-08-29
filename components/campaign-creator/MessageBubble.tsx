import { cn } from "@/lib/utils"
import type { ConversationMessage } from "@/lib/campaign-creator/types"

interface MessageBubbleProps {
  message: ConversationMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "system") {
    return (
      <p className="mx-auto max-w-md text-center text-xs text-muted-foreground">
        {message.content}
      </p>
    )
  }

  const isCustomer = message.role === "customer"

  return (
    <div className={cn("flex", isCustomer ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3.5 py-2 text-sm whitespace-pre-wrap",
          isCustomer
            ? "bg-primary text-primary-foreground"
            : "bg-card text-card-foreground ring-1 ring-foreground/10"
        )}
      >
        {message.content}
      </div>
    </div>
  )
}
