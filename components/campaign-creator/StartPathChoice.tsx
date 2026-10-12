"use client"

import { Sparkles, Upload } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface StartPathChoiceProps {
  onDesignWithAi: () => void
  onHaveDesign: () => void
}

const choiceCardClass =
  "flex min-h-52 w-full flex-1 cursor-pointer flex-col items-start gap-4 rounded-xl border bg-card p-5 text-left transition-colors hover:bg-muted/40 focus-visible:z-10 focus-visible:border-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-foreground/40"

export function StartPathChoice({ onDesignWithAi, onHaveDesign }: StartPathChoiceProps) {
  return (
    <div className="flex flex-col gap-6 py-6">
      <div
        role="group"
        aria-label="How to start this campaign"
        className="grid w-full grid-cols-1 items-stretch gap-3 sm:grid-cols-2"
      >
        {/* A plain wrapper stretches in the grid. A button as the grid item does not. */}
        <div className="flex">
          <ChoiceCard
            choice="ai"
            title="Design it with AI"
            description="Tell us your goal and our AI designs a ready-to-mail postcard in minutes."
            icon={<Sparkles className="size-4" />}
            emphasized
            onClick={onDesignWithAi}
          />
        </div>
        <div className="flex">
          <ChoiceCard
            choice="upload"
            title="I already have a design"
            description="Upload your own front and back. We'll check it for print and show you a proof."
            icon={<Upload className="size-4" />}
            onClick={onHaveDesign}
          />
        </div>
      </div>
    </div>
  )
}

function ChoiceCard({
  choice,
  title,
  description,
  icon,
  emphasized = false,
  onClick,
}: {
  choice: "ai" | "upload"
  title: string
  description: string
  icon: ReactNode
  emphasized?: boolean
  onClick: () => void
}) {
  const titleId = `start-${choice}-title`
  const descriptionId = `start-${choice}-description`

  return (
    <button
      type="button"
      data-choice={choice}
      data-slot="start-choice"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={onClick}
      className={cn(
        choiceCardClass,
        emphasized ? "border-foreground/25" : "border-border"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          emphasized ? "bg-foreground text-background" : "bg-muted text-foreground"
        )}
      >
        {icon}
      </span>
      <span className="flex flex-col gap-1.5">
        <span id={titleId} className="text-base font-medium tracking-tight text-foreground">
          {title}
        </span>
        <span id={descriptionId} className="text-sm leading-6 text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  )
}
