"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  COMPLIANCE_TEXT,
  industryById,
  INDUSTRY_CATEGORIES,
  type CertificationBoxes,
} from "@/lib/compliance/legal-text"

interface ComplianceChecksProps {
  industryId: string
  onIndustryId: (industryId: string) => void
  boxes: CertificationBoxes
  onBoxes: (boxes: CertificationBoxes) => void
  /** A previous approval still matches this proof, list, and category. */
  covered: boolean
  notice: string | null
  proof: ReactNode
  submitLabel: string
  submitDisabled: boolean
  onSubmit: () => void
}

export function ComplianceChecks({
  industryId,
  onIndustryId,
  boxes,
  onBoxes,
  covered,
  notice,
  proof,
  submitLabel,
  submitDisabled,
  onSubmit,
}: ComplianceChecksProps) {
  const industry = industryById(industryId)
  const locked = covered
  const shown = locked
    ? {
        reviewedProof: true,
        responsibility: true,
        listRights: true,
        industryAcknowledgment: true,
      }
    : boxes

  function toggle(key: keyof CertificationBoxes, value: boolean) {
    onBoxes({ ...boxes, [key]: value })
  }

  return (
    <section className="flex flex-col gap-4 border-t pt-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Final proof</h2>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {COMPLIANCE_TEXT.draftNotice}
        </p>
        <p className="text-sm text-muted-foreground">
          This is the postcard that will be printed. Nothing is sent until you approve it.
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>{proof}</div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="mailer-industry">
              {COMPLIANCE_TEXT.campaign.prompt}
            </label>
            <select
              id="mailer-industry"
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={industryId}
              onChange={(event) => onIndustryId(event.target.value)}
            >
              <option value="">Choose one</option>
              {INDUSTRY_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          {industry?.action === "block" && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
              {industry.warning}
            </p>
          )}

          {industry?.action === "warn" && (
            <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status">
              {industry.warning}
            </p>
          )}

          {industry && industry.action !== "block" && (
            <fieldset className="flex flex-col gap-2" disabled={locked}>
              <legend className="sr-only">Approve this proof</legend>
              <Check
                checked={shown.reviewedProof}
                onChange={(value) => toggle("reviewedProof", value)}
                text={COMPLIANCE_TEXT.campaign.boxes.reviewedProof}
              />
              <Check
                checked={shown.responsibility}
                onChange={(value) => toggle("responsibility", value)}
                text={COMPLIANCE_TEXT.campaign.boxes.responsibility}
              />
              <Check
                checked={shown.listRights}
                onChange={(value) => toggle("listRights", value)}
                text={COMPLIANCE_TEXT.campaign.boxes.listRights}
              />
              {industry.action === "warn" && (
                <Check
                  checked={shown.industryAcknowledgment}
                  onChange={(value) => toggle("industryAcknowledgment", value)}
                  text={industry.acknowledgment}
                />
              )}
            </fieldset>
          )}

          {covered && (
            <p className="text-sm text-muted-foreground" role="status">
              You already approved this proof and this list.
            </p>
          )}

          {notice && !covered && (
            <p className="text-sm text-destructive" role="status">
              {notice}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              className="h-auto whitespace-normal px-3 py-2 text-center"
              disabled={submitDisabled}
              onClick={onSubmit}
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Check({
  checked,
  onChange,
  text,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  text: string
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border p-3 text-sm leading-6">
      <input
        type="checkbox"
        className="mt-1 size-4 shrink-0 accent-foreground"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{text}</span>
    </label>
  )
}
