"use client"

import { useEffect, useRef, useState } from "react"

import type { UploadPathBasics } from "@/lib/bring-your-own-design/upload-path"

import { Composer } from "./Composer"
import { OpeningPrompt } from "./OpeningPrompt"
import { StartPathChoice } from "./StartPathChoice"
import { UploadBasicsForm } from "./upload/UploadBasicsForm"

export type OpeningStep = "choose" | "ai" | "upload"

interface CampaignOpeningProps {
  /** Lets tests render each path. The live screen always starts on the choice. */
  initialStep?: OpeningStep
  composerValue: string
  onComposerChange: (value: string) => void
  onSend: () => void
  sending?: boolean
  onSelectExample: (prompt: string) => void
  onSubmitUpload: (basics: UploadPathBasics) => Promise<void>
}

export function CampaignOpening({
  initialStep = "choose",
  composerValue,
  onComposerChange,
  onSend,
  sending = false,
  onSelectExample,
  onSubmitUpload,
}: CampaignOpeningProps) {
  const [step, setStep] = useState<OpeningStep>(initialStep)
  const panelRef = useRef<HTMLDivElement>(null)
  const skipInitialFocus = useRef(true)

  useEffect(() => {
    if (skipInitialFocus.current) {
      skipInitialFocus.current = false
      return
    }
    const root = panelRef.current
    if (!root) return
    const target =
      step === "choose"
        ? root.querySelector<HTMLElement>("[data-choice='ai']")
        : root.querySelector<HTMLElement>("h1")
    if (!target) return
    if (target.tagName === "H1") target.tabIndex = -1
    target.focus()
  }, [step])

  return (
    <div ref={panelRef} className="flex flex-col gap-6">
      {step === "choose" && (
        <StartPathChoice
          onDesignWithAi={() => setStep("ai")}
          onHaveDesign={() => setStep("upload")}
        />
      )}
      {step === "ai" && (
        <>
          <OpeningPrompt onSelectExample={onSelectExample} onBack={() => setStep("choose")} />
          <Composer
            value={composerValue}
            onValueChange={onComposerChange}
            onSend={onSend}
            disabled={sending}
          />
        </>
      )}
      {step === "upload" && (
        <UploadBasicsForm onBack={() => setStep("choose")} onSubmit={onSubmitUpload} />
      )}
    </div>
  )
}
