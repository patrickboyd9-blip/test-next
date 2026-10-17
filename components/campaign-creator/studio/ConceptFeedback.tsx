"use client"

import { useState, useTransition } from "react"
import { ThumbsDown, ThumbsUp } from "lucide-react"

import { voteOnConcept } from "@/lib/campaign-creator/actions"
import { cn } from "@/lib/utils"

/**
 * A quiet thumbs control on one concept.
 * The reason is optional. The score stays off the card.
 */

export function ConceptFeedback({
  campaignId,
  directionId,
}: {
  campaignId: string
  directionId: string
}) {
  const [vote, setVote] = useState<"up" | "down" | null>(null)
  const [reason, setReason] = useState("")
  const [pending, startTransition] = useTransition()

  function choose(next: "up" | "down") {
    const resolved = vote === next ? "clear" : next
    setVote(resolved === "clear" ? null : resolved)
    startTransition(async () => {
      await voteOnConcept(campaignId, directionId, resolved, reason)
    })
  }

  return (
    <div className="flex flex-col gap-2" data-concept-feedback="">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="This concept works"
          aria-pressed={vote === "up"}
          disabled={pending}
          onClick={() => choose("up")}
          className={cn(
            "rounded-md p-1.5 text-muted-foreground hover:text-foreground",
            vote === "up" && "text-foreground"
          )}
        >
          <ThumbsUp className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Not this concept"
          aria-pressed={vote === "down"}
          disabled={pending}
          onClick={() => choose("down")}
          className={cn(
            "rounded-md p-1.5 text-muted-foreground hover:text-foreground",
            vote === "down" && "text-foreground"
          )}
        >
          <ThumbsDown className="size-4" />
        </button>
      </div>
      {vote ? (
        <input
          value={reason}
          maxLength={160}
          placeholder="Optional: what should we remember?"
          aria-label="Why this concept"
          onChange={(event) => setReason(event.target.value)}
          onBlur={() => {
            if (!vote) return
            startTransition(async () => {
              await voteOnConcept(campaignId, directionId, vote, reason)
            })
          }}
          className="h-8 rounded-md border border-border bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground"
        />
      ) : null}
    </div>
  )
}
