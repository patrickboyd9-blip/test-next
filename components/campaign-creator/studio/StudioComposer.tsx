"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { REFINEMENT_APPLYING_LINE } from "@/lib/campaign-creator/studio-copy"
import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { cn } from "@/lib/utils"

const MAX_LENGTH = 500
const WARN_LENGTH = 480

function buildPlaceholders(brief: CampaignBrief): string[] {
  const offer = brief.offer ?? "your offer"
  return [
    "Make the headline bigger",
    "Use warmer colors",
    "Move the phone number to the bottom right",
    "Make the QR code more prominent",
    `Keep the offer but change the headline to "${offer}"`,
  ]
}

function buildSuggestionChips(brief: CampaignBrief): string[] {
  const chips = [
    "Make the headline bigger",
    "Use warmer colors",
    "Move the phone number to the bottom right",
    "Make the QR code more prominent",
  ]
  if (brief.offer) {
    chips.push(`Emphasize the offer: ${brief.offer}`)
  }
  return chips.slice(0, 4)
}

interface StudioComposerProps {
  brief: CampaignBrief
  value: string
  onValueChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
  isApplying?: boolean
  studioResponse?: string | null
  responseAssertive?: boolean
  autoFocus?: boolean
}

export function StudioComposer({
  brief,
  value,
  onValueChange,
  onSubmit,
  disabled = false,
  isApplying = false,
  studioResponse,
  responseAssertive = false,
  autoFocus = false,
}: StudioComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const responseId = useId()
  const placeholders = buildPlaceholders(brief)
  const chips = buildSuggestionChips(brief)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  useEffect(() => {
    if (disabled || isApplying || value.trim()) return

    const timer = window.setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % placeholders.length)
    }, 5000)

    return () => window.clearInterval(timer)
  }, [disabled, isApplying, placeholders.length, value])

  const handleSubmit = useCallback(() => {
    if (disabled || isApplying || !value.trim()) return
    onSubmit()
  }, [disabled, isApplying, onSubmit, value])

  const showLengthWarn = value.length >= WARN_LENGTH

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-xl border border-input bg-card p-3">
        <label htmlFor="studio-composer" className="text-sm font-medium">
          What would you like to change?
        </label>
        <Textarea
          ref={textareaRef}
          id="studio-composer"
          value={value}
          onChange={(e) => onValueChange(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          disabled={disabled || isApplying}
          placeholder={placeholders[placeholderIndex]}
          className="min-h-16 resize-none border-0 bg-transparent shadow-none"
          rows={2}
          aria-describedby={studioResponse ? responseId : undefined}
        />
        {isApplying && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {REFINEMENT_APPLYING_LINE}
          </p>
        )}
        {showLengthWarn && (
          <p className="text-xs text-muted-foreground">
            {MAX_LENGTH - value.length} characters remaining
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={disabled || isApplying}
              onClick={() => onValueChange(chip)}
              className={cn(
                "rounded-full border border-border px-3 py-1 text-xs transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                (disabled || isApplying) && "pointer-events-none opacity-50"
              )}
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={disabled || isApplying || !value.trim()}
          >
            Apply change
          </Button>
        </div>
      </div>

      {studioResponse && (
        <p
          id={responseId}
          className="text-sm text-muted-foreground"
          role="status"
          aria-live={responseAssertive ? "assertive" : "polite"}
        >
          {studioResponse}
        </p>
      )}
    </div>
  )
}
