import type { CampaignBrief } from "@/lib/campaign-creator/types"

import { complianceWarnings } from "./compliance"
import { industryForBrief } from "./industry"

/** Florida-style patient-rights notice (Fla. Stat. 456.062) for free or discounted dental services. */
export const DENTAL_FEE_DISCLAIMER =
  "THE PATIENT AND ANY OTHER PERSON RESPONSIBLE FOR PAYMENT HAS THE RIGHT TO REFUSE TO PAY, CANCEL PAYMENT, OR BE REIMBURSED FOR PAYMENT FOR ANY OTHER SERVICE, EXAMINATION, OR TREATMENT THAT IS PERFORMED AS A RESULT OF AND WITHIN 72 HOURS OF RESPONDING TO THE ADVERTISEMENT FOR THE FREE, DISCOUNTED FEE, OR REDUCED FEE SERVICE, EXAMINATION, OR TREATMENT."

export const EQUAL_HOUSING_MARK = "Equal Housing Opportunity"

const MEDICARE_DISCLAIMER =
  "We do not offer every plan available in your area. Any information we provide is limited to those plans we do offer in your area. Please contact Medicare.gov or 1-800-MEDICARE to get information on all of your options. Not connected with or endorsed by the U.S. government or the federal Medicare program."

function join(parts: Array<string | null | undefined>, sep: string): string | undefined {
  const kept = parts.map((p) => (p ?? "").trim()).filter(Boolean)
  return kept.length ? kept.join(sep) : undefined
}

/**
 * Adds the small-print lines a trade's playbook requires, so the card passes the
 * compliance check without the customer editing anything. Only lines we can print
 * truthfully are added: fixed legal wording, and an NMLS ID only when the brief has one.
 */
export function withRequiredDisclosures(input: {
  brief: CampaignBrief
  printedText: string
  disclaimer?: string | null
  complianceMark?: string | null
}): { disclaimer?: string; complianceMark?: string } {
  const industry = industryForBrief(input.brief, input.printedText)
  const location = [input.brief.businessInfo?.address, input.brief.businessInfo?.city].filter(Boolean).join(" ")
  const all = () => [input.printedText, marks.join(" "), disclaimers.join(" ")].join(" ")
  const marks: string[] = input.complianceMark?.trim() ? [input.complianceMark.trim()] : []
  const disclaimers: string[] = input.disclaimer?.trim() ? [input.disclaimer.trim()] : []
  const ids = new Set(complianceWarnings(all(), { industry, location, offer: input.brief.offer }).map((w) => w.id))
  if (ids.has("equal-housing")) marks.push(EQUAL_HOUSING_MARK)
  if (ids.has("mortgage-nmls")) {
    const nmls = /\bNMLS\s*(?:ID|#)?\s*#?\s*(\d{3,})/i.exec(input.brief.businessInfo?.license ?? "")?.[1]
    if (nmls) marks.push(`NMLS #${nmls}`)
  }
  if (ids.has("medicare-disclaimer")) disclaimers.push(MEDICARE_DISCLAIMER)
  if (ids.has("dental-fee-disclosure")) disclaimers.push(DENTAL_FEE_DISCLAIMER)
  return { disclaimer: join(disclaimers, " "), complianceMark: join(marks, " · ") }
}
