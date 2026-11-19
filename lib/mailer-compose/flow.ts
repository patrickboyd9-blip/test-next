/**
 * The simple mailer: who it goes to, what it should say, then a proof.
 * Approve records a preview. It does not mail or charge.
 */

export const COMPOSE_STEPS = ["to", "what", "proof"] as const
export type ComposeStep = (typeof COMPOSE_STEPS)[number]

/**
 * Where the list sits. False matches the documented handoff: the list comes
 * after the proof. True puts "To" first. Patrick has not chosen; do not
 * treat the default as a decision.
 */
export const LIST_BEFORE_PROOF = false

export function composeSteps(listBeforeProof = LIST_BEFORE_PROOF): ComposeStep[] {
  return listBeforeProof ? ["to", "what", "proof"] : ["what", "proof", "to"]
}

/**
 * From Home, with a saved list already on the account.
 * Screens: Home, then each compose step.
 * Clicks: New mailer, Continue on every step but the last, pick a list, Approve & mail.
 */
export function firstMailerEffort(listBeforeProof = LIST_BEFORE_PROOF): { screens: number; clicks: number } {
  const steps = composeSteps(listBeforeProof)
  return { screens: 1 + steps.length, clicks: 1 + (steps.length - 1) + 2 }
}

/** Full price slot. Not postage. Not a quote. The number is not invented. */
export const PLACEHOLDER_FULL_PRICE = {
  label: "Placeholder",
  detail:
    "Full price for printing, postage, and the list. Not postage by itself. Not a quote. Nothing is charged.",
} as const

export const MAILER_STATUSES = [
  "designing",
  "proof_ready",
  "printing",
  "in_the_mail",
  "delivered",
] as const
export type MailerStatus = (typeof MAILER_STATUSES)[number]

export const STATUS_LABEL: Record<MailerStatus, string> = {
  designing: "Designing",
  proof_ready: "Proof ready",
  printing: "Printing",
  in_the_mail: "In the mail",
  delivered: "Delivered",
}

/** Amber is only for something the owner has to do. */
export function statusNeedsYou(status: MailerStatus): boolean {
  return status === "proof_ready"
}

export interface SavedList {
  id: string
  name: string
  people: number
}

export interface InFlightMailer {
  id: string
  name: string
  listName: string
  people: number
  status: MailerStatus
  detail: string
}

export interface ComposeDraft {
  listId: string | null
  uploadedName: string | null
  uploadedPeople: number
  brief: string
  logoName: string | null
  size: "5x8" | "6x9"
  campaignName: string
  phone: string
  website: string
}

export const SAMPLE_SHOP = "Jordan's Plumbing"

export const SAVED_LISTS: SavedList[] = [
  { id: "nearby-homes", name: "Homeowners near the shop", people: 240 },
  { id: "last-year", name: "People we served last year", people: 86 },
]

export const SAMPLE_MAILERS: InFlightMailer[] = [
  {
    id: "spring-proof",
    name: "Spring tune-up",
    listName: "Homeowners near the shop",
    people: 240,
    status: "proof_ready",
    detail: "The proof is ready. Nothing goes out until you approve it.",
  },
  {
    id: "heater-print",
    name: "Water heater check",
    listName: "People we served last year",
    people: 86,
    status: "printing",
    detail: "Approved. The cards are being printed. This sample was not sent.",
  },
  {
    id: "drain-mail",
    name: "Slow drain note",
    listName: "Homeowners near the shop",
    people: 120,
    status: "in_the_mail",
    detail: "The cards are with the mail. This sample was not sent.",
  },
  {
    id: "welcome-done",
    name: "New neighbor hello",
    listName: "People we served last year",
    people: 40,
    status: "delivered",
    detail: "Marked delivered in this sample. No live tracking is attached.",
  },
]

export const SIZE_REQUIRED_MESSAGE = "Choose a 5×8 or a 6×9 postcard."

/** Nothing is chosen until the person picks. A stored default is not a choice. */
export function postcardSizeChosen(size: string | null): size is "5x8" | "6x9" {
  return size === "5x8" || size === "6x9"
}

export function emptyDraft(): ComposeDraft {
  return {
    listId: null,
    uploadedName: null,
    uploadedPeople: 0,
    brief: "",
    logoName: null,
    size: "5x8",
    campaignName: "",
    phone: "",
    website: "",
  }
}

export function countAddresses(csv: string): number {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (lines.length <= 1) return 0
  return lines.length - 1
}

export function selectedPeople(draft: ComposeDraft, lists: SavedList[] = SAVED_LISTS): number {
  if (draft.uploadedPeople > 0) return draft.uploadedPeople
  const list = lists.find((item) => item.id === draft.listId)
  return list?.people ?? 0
}

export function selectedListName(draft: ComposeDraft, lists: SavedList[] = SAVED_LISTS): string {
  if (draft.uploadedName && draft.uploadedPeople > 0) return draft.uploadedName
  return lists.find((item) => item.id === draft.listId)?.name ?? "No list yet"
}

/** A campaign needs a name before the design starts. Two characters is enough. */
export function campaignNameReady(name: string): boolean {
  const clean = name.replace(/\s+/g, " ").trim()
  return clean.length >= 2 && clean.length <= 80
}

function briefReady(draft: ComposeDraft): boolean {
  return draft.brief.replace(/\s+/g, " ").trim().length >= 12
}

export function canContinue(step: ComposeStep, draft: ComposeDraft): boolean {
  if (step === "to") return selectedPeople(draft) > 0
  if (step === "what") return briefReady(draft)
  return briefReady(draft)
}

export function canApprove(draft: ComposeDraft): boolean {
  return briefReady(draft) && selectedPeople(draft) > 0
}

export function nextStep(step: ComposeStep, listBeforeProof = LIST_BEFORE_PROOF): ComposeStep | null {
  const steps = composeSteps(listBeforeProof)
  const index = steps.indexOf(step)
  return steps[index + 1] ?? null
}

export function previousStep(step: ComposeStep, listBeforeProof = LIST_BEFORE_PROOF): ComposeStep | null {
  const steps = composeSteps(listBeforeProof)
  const index = steps.indexOf(step)
  return index > 0 ? steps[index - 1]! : null
}

export interface MailerProof {
  shop: string
  line: string
  to: string
  people: number
  phone: string
  website: string
  logoName: string | null
  /** A code is drawn only when the owner typed a web address. */
  qr: string | null
}

export function proofFromDraft(draft: ComposeDraft, shop = SAMPLE_SHOP): MailerProof {
  const website = draft.website.replace(/\s+/g, "").trim()
  return {
    shop,
    line: draft.brief.replace(/\s+/g, " ").trim(),
    to: selectedListName(draft),
    people: selectedPeople(draft),
    phone: draft.phone.replace(/\s+/g, " ").trim(),
    website,
    logoName: draft.logoName,
    qr: website.length > 0 ? website : null,
  }
}

export interface ApproveResult {
  status: MailerStatus
  mailed: false
  charged: false
  externalCalls: 0
}

/** Local preview only. The button does not create a mail job or a charge. */
export function approvePreview(): ApproveResult {
  return { status: "printing", mailed: false, charged: false, externalCalls: 0 }
}

export function mailerById(id: string): InFlightMailer | null {
  return SAMPLE_MAILERS.find((item) => item.id === id) ?? null
}
