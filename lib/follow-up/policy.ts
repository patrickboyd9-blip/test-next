/** Values the customer typed. Null means they have not chosen. Nothing here is a legal rule. */
export interface FollowUpPolicy {
  playSelected: boolean
  cap: number | null
  recentContactDays: number | null
  excludeConverted: boolean | null
  excludeOptOut: boolean | null
  mailPermission: boolean
  photoPermission: boolean
  storyPermission: boolean
}

export const SUGGESTED_PLAY = "unsold-estimate"

export function emptyPolicy(): FollowUpPolicy {
  return {
    playSelected: false,
    cap: null,
    recentContactDays: null,
    excludeConverted: null,
    excludeOptOut: null,
    mailPermission: false,
    photoPermission: false,
    storyPermission: false,
  }
}

export function policyGaps(policy: FollowUpPolicy): string[] {
  const gaps: string[] = []
  if (!policy.playSelected) gaps.push("Choose the unsold-estimate follow-up. It is only a suggestion until you select it.")
  if (policy.cap == null) gaps.push("Set a maximum number of pieces. No cap was assumed.")
  if (policy.recentContactDays == null) gaps.push("Say how many days count as a recent contact, or enter 0 if you are not excluding them.")
  if (policy.excludeConverted == null) gaps.push("Say whether converted jobs are excluded. No rule was assumed.")
  if (policy.excludeOptOut == null) gaps.push("Say whether opt-outs are excluded. No rule was assumed.")
  if (!policy.mailPermission) gaps.push("Confirm you have permission to mail this first-party list.")
  if (!policy.photoPermission) gaps.push("Confirm you have permission to use the job photos on this mailing.")
  if (!policy.storyPermission) gaps.push("Confirm you have permission to mention this customer's story, or leave stories off the card.")
  return gaps
}
