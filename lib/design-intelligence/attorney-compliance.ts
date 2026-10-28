/**
 * Florida Bar limits for a legal or accident-attorney mailer.
 * Advertisement is required. Dramatic imagery is a hard fail.
 * The 30-day wait is a warning, because the mail date is not on the card.
 */

export const ATTORNEY_AD_LABEL = "Advertisement"

const ATTORNEY = /\b(?:attorneys?|lawyers?|law firm|personal injury)\b/i
const DRAMATIC = /\b(?:gore|gory|bloody|bloodied|mangled|severed|crying (?:child|victim|widow)|screaming|crash scene|wreckage|graphic injury|ambulance lights)\b/i

export function isAttorneyMatter(text: string): boolean {
  return ATTORNEY.test(text)
}

export interface AttorneyCompliance {
  hardFails: Array<{ id: "attorney_label" | "attorney_imagery"; detail: string }>
  warnings: string[]
}

export function attorneyCompliance(input: {
  copy: string
  clientText: string
  photoText?: string
}): AttorneyCompliance {
  const matter = `${input.clientText} ${input.copy}`
  if (!isAttorneyMatter(matter)) return { hardFails: [], warnings: [] }
  const hardFails: AttorneyCompliance["hardFails"] = []
  if (!new RegExp(`\\b${ATTORNEY_AD_LABEL}\\b`, "i").test(input.copy)) {
    hardFails.push({ id: "attorney_label", detail: "An attorney card has to say Advertisement." })
  }
  if (DRAMATIC.test(`${input.copy} ${input.photoText ?? ""}`)) {
    hardFails.push({
      id: "attorney_imagery",
      detail: "Florida Bar 4-7.15 limits dramatic emotional imagery.",
    })
  }
  return {
    hardFails,
    warnings: attorneyWarnings(matter),
  }
}

export function attorneyWarnings(text: string): string[] {
  if (!isAttorneyMatter(text)) return []
  return ["Florida Bar 4-7.18: wait 30 days after an accident before mailing."]
}

/** The word the back of an attorney card has to print. */
export function attorneyAdMark(text: string): string | null {
  return isAttorneyMatter(text) ? ATTORNEY_AD_LABEL : null
}
