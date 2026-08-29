import { MessageBubble } from "./MessageBubble"
import type { ConversationMessage } from "@/lib/campaign-creator/types"

interface ConversationThreadProps {
  messages: ConversationMessage[]
  isThinking: boolean
}

export function ConversationThread({ messages, isThinking }: ConversationThreadProps) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
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
