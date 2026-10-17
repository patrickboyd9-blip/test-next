"use client"

import { useState } from "react"
import { ThumbsDown, ThumbsUp } from "lucide-react"

import { saveConceptFeedback, type ConceptFeedbackView } from "@/lib/campaign-creator/actions"
import { cn } from "@/lib/utils"

/**
 * A quiet thumbs control on a concept. The reason is optional.
 * Scores stay off this control.
 */
export function ConceptFeedback({
  campaignId,
  directionId,
  initial,
}: {
  campaignId: string
  directionId: string
  initial?: ConceptFeedbackView
}) {
  const [vote, setVote] = useState<"up" | "down" | null>(initial?.vote ?? null)
  const [reason, setReason] = useState(initial?.reason ?? "")
  const [savedReason, setSavedReason] = useState(initial?.reason ?? "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function choose(next: "up" | "down") {
    setPending(true)
    setError("")
    try {
      const saved = await saveConceptFeedback({
        campaignId,
        directionId,
        vote: next,
        reason: reason.trim() || undefined,
      })
      setVote(saved.vote)
      setSavedReason(saved.reason)
    } catch {
      setError("Could not save that. Try again.")
    } finally {
      setPending(false)
    }
  }

  async function commitReason() {
    if (!vote || reason.trim() === savedReason) return
    await choose(vote)
  }

  return (
    <div className="flex flex-col gap-2" data-concept-feedback="">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Does this direction work?</span>
        <button
          type="button"
          aria-label="This direction works"
          aria-pressed={vote === "up"}
          disabled={pending}
          onClick={() => void choose("up")}
          className={cn(
            "rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground",
            vote === "up" && "border-foreground/30 text-foreground"
          )}
        >
          <ThumbsUp className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="This direction does not work"
          aria-pressed={vote === "down"}
          disabled={pending}
          onClick={() => void choose("down")}
          className={cn(
            "rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground",
            vote === "down" && "border-foreground/30 text-foreground"
          )}
        >
          <ThumbsDown className="size-3.5" />
        </button>
      </div>
      {vote ? (
        <input
          value={reason}
          maxLength={240}
          placeholder="Optional: what should we keep or change?"
          aria-label="Why this direction works or does not"
          onChange={(event) => setReason(event.target.value)}
          onBlur={() => void commitReason()}
          className="h-8 rounded-md border border-border bg-transparent px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
