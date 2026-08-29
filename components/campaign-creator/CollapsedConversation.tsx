"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ConversationMessage } from "@/lib/campaign-creator/types"

import { ConversationThread } from "./ConversationThread"

interface CollapsedConversationProps {
  messages: ConversationMessage[]
  className?: string
}

export function CollapsedConversation({ messages, className }: CollapsedConversationProps) {
  const [open, setOpen] = useState(false)

  if (messages.length === 0) return null

  return (
    <div className={cn("rounded-xl border border-border bg-card/50", className)}>
      <Button
        variant="ghost"
        className="flex h-auto w-full items-center justify-between px-4 py-3 text-sm font-medium"
        onClick={() => setOpen((value) => !value)}
      >
        <span>View conversation ({messages.length} messages)</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </Button>
      {open && (
        <div className="max-h-64 overflow-y-auto border-t border-border px-4 py-3">
          <ConversationThread messages={messages} isThinking={false} />
        </div>
      )}
    </div>
  )
}
