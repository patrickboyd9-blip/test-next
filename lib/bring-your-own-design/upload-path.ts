import { isAtOrPastStatus } from "@/lib/campaign-creator/campaign-status"
import { assignDefaultMailPieceSpec } from "@/lib/campaign-creator/mail-piece"
import type { Campaign } from "@/lib/campaign-creator/types"

/** Name and return address collected before an uploaded design. */
export interface UploadPathBasics {
  campaignName: string
  businessName: string
  street: string
  city: string
  state: string
  postalCode: string
}

export type UploadPathBasicsResult =
  | { ok: true; value: UploadPathBasics }
  | { ok: false; error: string }

const NAME_MAX = 80
const STREET_MAX = 64
const CITY_MAX = 40

export function parseUploadPathBasics(input: Partial<UploadPathBasics> | undefined): UploadPathBasicsResult {
  const campaignName = clean(input?.campaignName)
  const businessName = clean(input?.businessName)
  const street = clean(input?.street)
  const city = clean(input?.city)
  const state = clean(input?.state).toUpperCase()
  const postalCode = clean(input?.postalCode)

  if (!campaignName) return { ok: false, error: "Add a name for this campaign." }
  if (campaignName.length > NAME_MAX) {
    return { ok: false, error: "Use a shorter campaign name." }
  }
  if (!businessName) return { ok: false, error: "Add the business name for the return address." }
  if (businessName.length > NAME_MAX) {
    return { ok: false, error: "Use a shorter business name." }
  }
  if (!street) return { ok: false, error: "Add the return street address." }
  if (street.length > STREET_MAX) return { ok: false, error: "Use a shorter street address." }
  if (!city) return { ok: false, error: "Add the return city." }
  if (city.length > CITY_MAX) return { ok: false, error: "Use a shorter city name." }
  if (!/^[A-Z]{2}$/.test(state)) return { ok: false, error: "Use the two-letter state, such as TX." }
  if (!/^\d{5}(?:-\d{4})?$/.test(postalCode)) {
    return { ok: false, error: "Use a 5-digit ZIP code." }
  }

  return {
    ok: true,
    value: { campaignName, businessName, street, city, state, postalCode },
  }
}

/**
 * Opens the upload path from the first screen.
 * Skips the strategy conversation and Studio. Writes the 5×8 mail piece
 * the printer needs, and keeps any files already uploaded.
 */
export function applyUploadPathStart(
  campaign: Campaign,
  input: Partial<UploadPathBasics> | undefined,
  now: string
): void {
  const parsed = parseUploadPathBasics(input)
  if (!parsed.ok) throw new Error(parsed.error)

  const approved =
    Boolean(campaign.mailPiece) || isAtOrPastStatus(campaign.status, "creative_approved")
  if (approved) {
    throw new Error("Unapprove the postcard before changing these details.")
  }

  const fresh = campaign.status === "draft" && !campaign.designSource
  const updating =
    campaign.entry === "upload" &&
    campaign.designSource === "upload" &&
    campaign.status === "strategy_confirmed"
  if (!fresh && !updating) {
    throw new Error("Start from the first screen to upload a design.")
  }

  const value = parsed.value
  campaign.name = value.campaignName
  campaign.entry = "upload"
  campaign.brief = {
    ...campaign.brief,
    businessInfo: {
      ...campaign.brief.businessInfo,
      name: value.businessName,
      street: value.street,
      city: value.city,
      state: value.state,
      postalCode: value.postalCode,
      address: `${value.street}, ${value.city}, ${value.state} ${value.postalCode}`,
    },
  }
  assignDefaultMailPieceSpec(campaign, now)
  campaign.designSource = "upload"
  campaign.status = "strategy_confirmed"
  campaign.updatedAt = now
}

/** Returns an upload-first campaign to the strategy conversation. Drops the uploaded files. */
export function applyLeaveUploadPath(campaign: Campaign, now: string): void {
  if (campaign.entry !== "upload") {
    throw new Error("This campaign is not using an uploaded design.")
  }
  if (campaign.mailPiece || isAtOrPastStatus(campaign.status, "creative_approved")) {
    throw new Error("Unapprove the postcard before switching.")
  }
  campaign.entry = undefined
  campaign.designSource = undefined
  campaign.uploadedDesign = undefined
  campaign.mailPieceSpec = undefined
  campaign.status = "draft"
  campaign.updatedAt = now
}

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}
