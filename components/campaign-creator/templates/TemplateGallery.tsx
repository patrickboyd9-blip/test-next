"use client"

import { useMemo, useState } from "react"
import { ChevronLeft } from "lucide-react"

import { PostcardPreview } from "@/components/campaign-creator/studio/PostcardPreview"
import { toCreativeCanvas } from "@/lib/campaign-creator/creative-canvas"
import { getMailPiece } from "@/lib/mail-catalog/catalog"
import { listMailTemplates } from "@/lib/mail-templates/query"
import {
  TEMPLATE_INDUSTRIES,
  TEMPLATE_INDUSTRY_LABELS,
  type MailTemplate,
  type TemplateIndustry,
} from "@/lib/mail-templates/types"
import { cn } from "@/lib/utils"

interface TemplateGalleryProps {
  onBack: () => void
  onSelect: (templateId: string) => Promise<void>
}

export function TemplateGallery({ onBack, onSelect }: TemplateGalleryProps) {
  const [industry, setIndustry] = useState<TemplateIndustry | "all">("all")
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canvas = useMemo(
    () => toCreativeCanvas(getMailPiece("postcard_5x8", 1)),
    []
  )
  const templates = listMailTemplates(industry === "all" ? undefined : industry)

  async function choose(template: MailTemplate) {
    if (pendingId) return
    setPendingId(template.id)
    setError(null)
    try {
      await onSelect(template.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That mailer could not be opened.")
      setPendingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1 rounded-md py-1 pr-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Back
      </button>

      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Start from a template</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Browse proven mailers for your industry, then let AI tailor one to your business.
        </p>
      </div>

      <div
        role="group"
        aria-label="Filter by industry"
        className="flex flex-wrap gap-2"
      >
        <FilterChip
          label="All"
          pressed={industry === "all"}
          onClick={() => setIndustry("all")}
        />
        {TEMPLATE_INDUSTRIES.map((value) => (
          <FilterChip
            key={value}
            label={TEMPLATE_INDUSTRY_LABELS[value]}
            pressed={industry === value}
            onClick={() => setIndustry(value)}
          />
        ))}
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {templates.map((template) => (
          <li key={template.id}>
            <button
              type="button"
              data-slot="template-card"
              data-template-id={template.id}
              data-industry={template.industry}
              disabled={pendingId !== null}
              onClick={() => void choose(template)}
              className="flex h-full w-full cursor-pointer flex-col gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/40 focus-visible:border-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-foreground/40 disabled:cursor-wait"
            >
              <div className="overflow-hidden rounded-lg bg-muted">
                <PostcardPreview
                  canvas={canvas}
                  spec={template.spec}
                  size="thumbnail"
                  enableHoverTilt={false}
                  allowLibraryFallback
                  identity={{
                    businessName: template.sampleBusinessName,
                    phone: template.spec.phone,
                    website: template.spec.website,
                    qrDestination: template.spec.qrDestination,
                  }}
                  ariaLabel={`${template.name} postcard`}
                />
              </div>
              <span className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  {TEMPLATE_INDUSTRY_LABELS[template.industry]} · 5×8
                </span>
                <span className="text-sm font-medium tracking-tight">{template.name}</span>
                <span className="text-sm leading-6 text-muted-foreground">{template.summary}</span>
              </span>
              <span className="text-sm font-medium">
                {pendingId === template.id ? "Opening the editor…" : "Use this mailer"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function FilterChip({
  label,
  pressed,
  onClick,
}: {
  label: string
  pressed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        pressed
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:bg-muted/40"
      )}
    >
      {label}
    </button>
  )
}
