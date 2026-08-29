"use client"

import { useState } from "react"
import type { KeyboardEvent } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface ComposerProps {
  value: string
  onValueChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
}

export function Composer({ value, onValueChange, onSend, disabled }: ComposerProps) {
  const [isFocused, setIsFocused] = useState(false)

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      if (!disabled && value.trim()) onSend()
    }
  }

  return (
    <div
      className={
        "flex items-end gap-2 rounded-xl border border-input bg-card p-2 transition-colors " +
        (isFocused ? "border-ring ring-3 ring-ring/50" : "")
      }
    >
      <Textarea
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Tell Modern Mail what you want to accomplish…"
        disabled={disabled}
        className="min-h-10 flex-1 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
        rows={1}
      />
      <Button onClick={onSend} disabled={disabled || !value.trim()}>
        Send
      </Button>
    </div>
  )
}
