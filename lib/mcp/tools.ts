import type { CampaignRepository } from "@/lib/campaign-creator/repository"
import type { Campaign } from "@/lib/campaign-creator/types"
import { saveDesignFace } from "@/lib/bring-your-own-design/save-face"
import type { UploadedDesignStore } from "@/lib/bring-your-own-design/store"
import { resolveUploadedDesignStore } from "@/lib/bring-your-own-design/store"
import { listIdentity, reviewCustomerList } from "@/lib/mail-journey/list-import"
import type { JourneyStore } from "@/lib/mail-journey/job"
import { buildQuote, readApprovedSchedule } from "@/lib/mail-journey/pricing"
import { freezeProof } from "@/lib/mail-journey/proof"
import { listMailTemplates } from "@/lib/mail-templates/query"
import { TEMPLATE_INDUSTRIES, TEMPLATE_INDUSTRY_LABELS, isTemplateIndustry } from "@/lib/mail-templates/types"
import { PLACEHOLDER_FULL_PRICE } from "@/lib/mailer-compose/flow"
import { readAudit } from "@/lib/ops/audit"
import { beginMailAction, finishMailAction, priceMailer } from "@/lib/ops/mail-flow"
import { RateLimitError } from "@/lib/ops/rate-limit"
import { approvalFitsCap, formatDollars } from "@/lib/ops/spend-cap"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"
import { resultsFor as ledgerFor } from "@/lib/tracking/ledger"
import { presentResults } from "@/lib/tracking/present"

import { listCustomerLists, readOwnedList, saveCustomerList } from "./lists"
import { leaksInternalText, toPublic } from "./public"

export interface McpContext {
  userId: string
  origin: string
  repository: CampaignRepository
  journey: JourneyStore
  designs?: UploadedDesignStore
  env?: NodeJS.ProcessEnv
}

interface ToolSpec {
  name: string
  description: string
  action: "create" | "proof" | "status"
  inputSchema: Record<string, unknown>
  run: (args: Record<string, unknown>, ctx: McpContext) => Promise<Record<string, unknown>>
}

const SIZE = { type: "string", enum: ["5x8", "6x9"], description: "Postcard size. 5x8 or 6x9." }
const CAMPAIGN = { type: "string", description: "The mailer id returned when it was created." }

const FULL_PRICE_DETAIL =
  "Full price for printing, postage, and the list. Not postage by itself. Nothing is charged until you approve it in Modern Mail."

export const MCP_TOOLS: readonly ToolSpec[] = [
  {
    name: "create_mailer",
    action: "create",
    description:
      "Create a mailer from a short brief. The campaign name and the postcard size (5x8 or 6x9) are required. Nothing is printed or charged.",
    inputSchema: {
      type: "object",
      required: ["name", "size", "brief"],
      properties: {
        name: { type: "string", description: "Campaign name." },
        size: SIZE,
        brief: { type: "string", description: "What the mailer should say and who it is for." },
        offer: { type: "string" },
        audience: { type: "string" },
        phone: { type: "string" },
        website: { type: "string" },
      },
      additionalProperties: false,
    },
    run: createMailer,
  },
  {
    name: "upload_design",
    action: "proof",
    description:
      "Upload the front or the back of a postcard as a PDF, PNG, or JPG. The first upload needs a return address. Nothing is printed or charged.",
    inputSchema: {
      type: "object",
      required: ["campaignId", "face", "fileName", "contentBase64"],
      properties: {
        campaignId: CAMPAIGN,
        face: { type: "string", enum: ["front", "back"] },
        fileName: { type: "string" },
        contentBase64: { type: "string", description: "The file, base64 encoded." },
        businessName: { type: "string" },
        street: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        postalCode: { type: "string" },
      },
      additionalProperties: false,
    },
    run: uploadDesign,
  },
  {
    name: "list_gallery",
    action: "status",
    description: "List Gallery photos the customer can start from. Names and summaries only.",
    inputSchema: {
      type: "object",
      properties: { industry: { type: "string", description: "Optional. One of the gallery industries." } },
      additionalProperties: false,
    },
    run: listGallery,
  },
  {
    name: "use_gallery_template",
    action: "create",
    description: "Start a 5x8 mailer from a Gallery photo. A 6x9 campaign cannot use these photos.",
    inputSchema: {
      type: "object",
      required: ["campaignId", "templateId"],
      properties: { campaignId: CAMPAIGN, templateId: { type: "string" } },
      additionalProperties: false,
    },
    run: useTemplate,
  },
  {
    name: "upload_list",
    action: "create",
    description:
      "Upload an address list as CSV and attach it to a mailer. Required columns: first, last, street, city, state, zip. The rows are not repeated back.",
    inputSchema: {
      type: "object",
      required: ["campaignId", "name", "csv"],
      properties: {
        campaignId: CAMPAIGN,
        name: { type: "string" },
        csv: { type: "string" },
      },
      additionalProperties: false,
    },
    run: uploadList,
  },
  {
    name: "list_lists",
    action: "status",
    description: "List address lists saved on this account. Counts stay off until a list is chosen.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: listLists,
  },
  {
    name: "choose_list",
    action: "create",
    description: "Attach one of this account's saved lists to a mailer.",
    inputSchema: {
      type: "object",
      required: ["campaignId", "listId"],
      properties: { campaignId: CAMPAIGN, listId: { type: "string" } },
      additionalProperties: false,
    },
    run: chooseList,
  },
  {
    name: "get_proof_and_price",
    action: "proof",
    description:
      "Show whether the proof is ready and the full price. The full price covers printing, postage, and the list. It is never postage by itself. Nothing is charged.",
    inputSchema: {
      type: "object",
      required: ["campaignId"],
      properties: { campaignId: CAMPAIGN },
      additionalProperties: false,
    },
    run: proofAndPrice,
  },
  {
    name: "request_approval",
    action: "proof",
    description:
      "Ask the customer to approve the proof and the full price in Modern Mail. This does not approve, print, or charge.",
    inputSchema: {
      type: "object",
      required: ["campaignId"],
      properties: { campaignId: CAMPAIGN },
      additionalProperties: false,
    },
    run: requestApproval,
  },
  {
    name: "duplicate_mailer",
    action: "create",
    description: "Copy one of this account's mailers. The copy still has to be approved in Modern Mail. Nothing is printed or charged.",
    inputSchema: {
      type: "object",
      required: ["campaignId"],
      properties: { campaignId: CAMPAIGN },
      additionalProperties: false,
    },
    run: duplicateMailer,
  },
  {
    name: "mailer_status",
    action: "status",
    description: "Status for one mailer, plus recorded QR scans, tracking calls, and responses. Empty stays empty. Nothing is estimated.",
    inputSchema: {
      type: "object",
      required: ["campaignId"],
      properties: { campaignId: CAMPAIGN },
      additionalProperties: false,
    },
    run: mailerStatus,
  },
]

export function toolCatalog(): { name: string; description: string; inputSchema: Record<string, unknown> }[] {
  return MCP_TOOLS.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema }))
}

export async function callMcpTool(name: string, args: unknown, ctx: McpContext): Promise<{ text: string; isError: boolean }> {
  const tool = MCP_TOOLS.find((item) => item.name === name)
  if (!tool) {
    return { text: JSON.stringify({ message: "That action is not available.", mailed: false, charged: false }), isError: true }
  }
  const record = asRecord(args)
  const subjectId = text(record, "campaignId") || ctx.userId
  try {
    await beginMailAction(ctx.userId, tool.action)
  } catch (error) {
    if (error instanceof RateLimitError) {
      await finishMailAction({
        actorId: ctx.userId,
        action: tool.action,
        subjectId,
        before: null,
        after: { refused: "rate", charged: false, mailed: false },
      })
      return { text: JSON.stringify({ message: error.message, mailed: false, charged: false }), isError: true }
    }
    throw error
  }
  try {
    const value = toPublic(await tool.run(record, ctx))
    const subject = typeof value.campaignId === "string" ? value.campaignId : subjectId
    await finishMailAction({
      actorId: ctx.userId,
      action: tool.action,
      subjectId: subject,
      before: null,
      after: { ok: true, charged: false, mailed: false },
    })
    return { text: JSON.stringify(value), isError: false }
  } catch (error) {
    const message = customerError(error)
    await finishMailAction({
      actorId: ctx.userId,
      action: tool.action,
      subjectId,
      before: null,
      after: { ok: false, message, charged: false, mailed: false },
    })
    return { text: JSON.stringify({ message, mailed: false, charged: false }), isError: true }
  }
}

async function createMailer(args: Record<string, unknown>, ctx: McpContext): Promise<Record<string, unknown>> {
  const name = text(args, "name")
  const size = text(args, "size")
  const brief = text(args, "brief")
  if (!name) throw new Error("Add a campaign name.")
  if (size !== "5x8" && size !== "6x9") throw new Error("Choose a postcard size: 5x8 or 6x9.")
  if (brief.length < 8) throw new Error("Add a short brief for what this mailer should say.")
  const campaign = await ctx.repository.createCampaign(ctx.userId)
  await ctx.repository.updateBrief(campaign.id, {
    goal: brief.slice(0, 4000),
    offer: text(args, "offer") || undefined,
    phone: text(args, "phone") || undefined,
    website: text(args, "website") || undefined,
    qrDestination: text(args, "website") || undefined,
    otherRequirements: text(args, "audience") || undefined,
  })
  const saved = await ctx.repository.setMailerFacts(campaign.id, { name, postcardSize: size })
  return {
    campaignId: saved.id,
    name: saved.name,
    size: saved.postcardSize,
    status: "Designing",
    mailed: false,
    charged: false,
    next: "Upload a design or pick a gallery mailer, then add a list. You approve the proof and the full price in Modern Mail.",
  }
}

async function uploadDesign(args: Record<string, unknown>, ctx: McpContext): Promise<Record<string, unknown>> {
  const campaign = await owned(ctx, text(args, "campaignId"))
  const face = text(args, "face")
  if (face !== "front" && face !== "back") throw new Error("Choose the front or the back.")
  const bytes = decodeFile(text(args, "contentBase64"))
  if (!bytes) throw new Error("That file is empty or too large. Use a PDF, PNG, or JPG under 8 MB.")
  if (campaign.designSource === "studio") {
    throw new Error("This mailer uses a gallery design. Duplicate it, or create a new mailer, to upload your own.")
  }
  if (campaign.designSource !== "upload") {
    await ctx.repository.beginUploadPath(campaign.id, {
      campaignName: campaign.name ?? "Mailer",
      businessName: text(args, "businessName"),
      street: text(args, "street"),
      city: text(args, "city"),
      state: text(args, "state"),
      postalCode: text(args, "postalCode"),
    })
  }
  const current = await owned(ctx, campaign.id)
  const geometry = current.postcardSize === "6x9" ? buildPostcard6x9PrintSpec() : undefined
  const design = await saveDesignFace({
    campaign: current,
    face,
    fileName: text(args, "fileName") || `${face}.png`,
    bytes,
    declaredType: "",
    store: designs(ctx),
    geometry,
  })
  const saved = await ctx.repository.saveUploadedDesign(current.id, design)
  const issues = (saved.uploadedDesign?.issues ?? []).map((issue) => ({ face: issue.face, message: issue.message }))
  return {
    campaignId: saved.id,
    face,
    front: Boolean(saved.uploadedDesign?.front),
    back: Boolean(saved.uploadedDesign?.back),
    issues,
    mailed: false,
    charged: false,
  }
}

async function listGallery(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const industry = text(args, "industry")
  const selected = isTemplateIndustry(industry) ? industry : undefined
  if (industry && !selected) {
    return {
      message: "That industry is not in the gallery.",
      industries: TEMPLATE_INDUSTRIES.map((id) => TEMPLATE_INDUSTRY_LABELS[id]),
      mailed: false,
      charged: false,
    }
  }
  const templates = listMailTemplates(selected).map((template) => ({
    id: template.id,
    name: template.name,
    summary: template.summary,
    industry: TEMPLATE_INDUSTRY_LABELS[template.industry],
    size: "5x8" as const,
  }))
  return { templates, mailed: false, charged: false }
}

async function useTemplate(args: Record<string, unknown>, ctx: McpContext): Promise<Record<string, unknown>> {
  const campaign = await owned(ctx, text(args, "campaignId"))
  if (campaign.postcardSize === "6x9") {
    throw new Error("Gallery mailers are 5×8. Create a 5×8 mailer to use one.")
  }
  const name = campaign.name
  const saved = await ctx.repository.beginTemplatePath(campaign.id, text(args, "templateId"))
  const renamed = name ? await ctx.repository.setMailerFacts(saved.id, { name, postcardSize: "5x8" }) : saved
  return {
    campaignId: renamed.id,
    name: renamed.name,
    size: "5x8",
    status: "Designing",
    mailed: false,
    charged: false,
    next: "Add a list, then review the proof and the full price in Modern Mail.",
  }
}

async function uploadList(args: Record<string, unknown>, ctx: McpContext): Promise<Record<string, unknown>> {
  const campaign = await owned(ctx, text(args, "campaignId"))
  const csv = text(args, "csv")
  if (!csv || csv.length > 1_000_000) throw new Error("Add a CSV address list under 1 MB.")
  const review = reviewCustomerList(csv)
  if (review.headerError) throw new Error(review.headerError)
  const saved = await saveCustomerList({ ownerId: ctx.userId, name: text(args, "name"), csv })
  await attachList(ctx, campaign.id, csv)
  return listSummary(saved.id, saved.name, review)
}

async function listLists(_args: Record<string, unknown>, ctx: McpContext): Promise<Record<string, unknown>> {
  const lists = await listCustomerLists(ctx.userId)
  return {
    lists,
    message: lists.length === 0 ? "You have no saved lists yet. Upload a CSV with first, last, street, city, state, and zip." : undefined,
    mailed: false,
    charged: false,
  }
}

async function chooseList(args: Record<string, unknown>, ctx: McpContext): Promise<Record<string, unknown>> {
  const campaign = await owned(ctx, text(args, "campaignId"))
  const list = await readOwnedList(ctx.userId, text(args, "listId"))
  if (!list) throw new Error("That list was not found on this account.")
  const review = reviewCustomerList(list.csv)
  await attachList(ctx, campaign.id, list.csv)
  return listSummary(list.id, list.name, review)
}

async function proofAndPrice(args: Record<string, unknown>, ctx: McpContext): Promise<Record<string, unknown>> {
  const campaign = await owned(ctx, text(args, "campaignId"))
  return {
    campaignId: campaign.id,
    ...(await priceBlock(ctx, campaign)),
    approvePath: approvePath(campaign.id),
  }
}

async function requestApproval(args: Record<string, unknown>, ctx: McpContext): Promise<Record<string, unknown>> {
  const campaign = await owned(ctx, text(args, "campaignId"))
  const price = await priceBlock(ctx, campaign)
  let capNote = "A full price is not ready yet."
  if (typeof price.pieceCount === "number" && price.pieceCount > 0 && price.label !== "Placeholder") {
    const amount = dollarCents(String(price.total ?? ""))
    if (amount > 0) {
      const cap = await approvalFitsCap(ctx.userId, campaign.id, amount)
      capNote = cap.ok
        ? "This total fits your spending cap. Approve it in Modern Mail. Nothing is charged until you do."
        : cap.message
    }
  }
  return {
    campaignId: campaign.id,
    approved: false,
    charged: false,
    mailed: false,
    ...price,
    cap: capNote,
    message: "Approval happens in Modern Mail. Open the mailer, review the proof and the full price, and approve it there. Nothing prints until you do.",
    approvePath: approvePath(campaign.id),
  }
}

async function duplicateMailer(args: Record<string, unknown>, ctx: McpContext): Promise<Record<string, unknown>> {
  const campaign = await owned(ctx, text(args, "campaignId"))
  const copy = await ctx.repository.cloneCampaign(campaign.id, ctx.userId)
  let designNote: string | undefined
  if (campaign.uploadedDesign) {
    const copied = await copyDesignFiles(campaign.id, copy.id, campaign, designs(ctx))
    if (!copied) designNote = "The design files were not copied. Upload the front and the back again on the copy."
  }
  return {
    campaignId: copy.id,
    name: copy.name,
    size: copy.postcardSize ?? null,
    copiedFrom: campaign.id,
    designNote,
    approved: false,
    charged: false,
    mailed: false,
    next: "This copy still needs your approval in Modern Mail before anything prints or charges.",
  }
}

async function mailerStatus(args: Record<string, unknown>, ctx: McpContext): Promise<Record<string, unknown>> {
  const campaign = await owned(ctx, text(args, "campaignId"))
  const events = await readAudit()
  const approved = events.some((event) => event.action === "approve" && event.actorId === ctx.userId && event.subjectId === campaign.id)
  const charged = events.some((event) => {
    if (event.action !== "charge" || event.actorId !== ctx.userId || event.subjectId !== campaign.id) return false
    const after = event.after as { charged?: boolean } | null
    return after?.charged === true
  })
  const proof = freezeProof(campaign)
  const status = charged
    ? "Paid"
    : approved
      ? "Approved"
      : proof.ok
        ? "Proof ready"
        : "Designing"
  const detail = charged
    ? "Payment is confirmed. Nothing has been mailed from this connection."
    : approved
      ? "You approved the proof and the full price in Modern Mail. Nothing has been mailed."
      : proof.ok
        ? "The proof is ready. Nothing prints until you approve it in Modern Mail."
        : "This mailer still needs a design, a list, or both."
  const ledger = ledgerFor(campaign.id, ctx.userId)
  const rows = presentResults(ledger)
  const value = (label: string) => rows.find((row) => row.label === label)?.value ?? "Not recorded yet"
  return {
    campaignId: campaign.id,
    name: campaign.name ?? "Mailer",
    size: campaign.postcardSize ?? null,
    status,
    detail,
    results: {
      scans: value("Scans"),
      calls: value("Calls"),
      responses: value("Bookings"),
    },
    mailed: false,
    charged,
    approvePath: approvePath(campaign.id),
  }
}

async function priceBlock(ctx: McpContext, campaign: Campaign): Promise<Record<string, unknown>> {
  const env = ctx.env ?? process.env
  const priced = await priceMailer(ctx.userId, campaign.id, env)
  const stored = await ctx.journey.getListReview(campaign.id, ctx.userId)
  const review = stored ? reviewCustomerList(stored.csv) : null
  const pieceCount = review?.acceptedCount ?? 0
  const proof = freezeProof(campaign)
  const quote = buildQuote(readApprovedSchedule(env), pieceCount, new Date().toISOString())
  const ready = quote.ok && priced.configured
  return {
    proofReady: proof.ok,
    proofNote: proof.ok ? "The front and the back are ready to review." : "Add a front and a back before this can be approved.",
    pieceCount,
    listReady: Boolean(review && !review.headerError && review.invalid.length === 0 && pieceCount > 0),
    label: ready ? formatDollars(quote.quote.totalCents) : PLACEHOLDER_FULL_PRICE.label,
    total: ready ? formatDollars(quote.quote.totalCents) : null,
    detail: ready ? FULL_PRICE_DETAIL : PLACEHOLDER_FULL_PRICE.detail,
    postageOnly: false,
    fullPrice: true,
    mailed: false,
    charged: false,
  }
}

async function attachList(ctx: McpContext, campaignId: string, csv: string): Promise<void> {
  await ctx.journey.saveListReview({
    campaignId,
    ownerId: ctx.userId,
    csv,
    createdAt: new Date().toISOString(),
  })
}

function listSummary(
  listId: string,
  name: string,
  review: ReturnType<typeof reviewCustomerList>
): Record<string, unknown> {
  const identity = listIdentity(review.accepted)
  return {
    listId,
    name,
    accepted: identity.count,
    invalid: review.invalid.length,
    duplicates: review.duplicates.length,
    note: review.validationNote,
    mailed: false,
    charged: false,
  }
}

async function owned(ctx: McpContext, campaignId: string): Promise<Campaign> {
  if (!campaignId) throw new Error("That mailer was not found.")
  const campaign = await ctx.repository.getCampaign(campaignId)
  if (!campaign || campaign.ownerId !== ctx.userId) throw new Error("That mailer was not found.")
  return campaign
}

function designs(ctx: McpContext): UploadedDesignStore {
  return ctx.designs ?? resolveUploadedDesignStore()
}

async function copyDesignFiles(fromId: string, toId: string, campaign: Campaign, store: UploadedDesignStore): Promise<boolean> {
  const design = campaign.uploadedDesign
  if (!design) return false
  let copied = false
  for (const face of ["front", "back"] as const) {
    const file = design[face]
    if (!file) continue
    const original = await store.get(fromId, file.key)
    if (!original) continue
    await store.put(toId, file.key, original.bytes, file.mediaType)
    copied = true
    if (file.preparedKey) {
      const prepared = await store.get(fromId, file.preparedKey)
      if (prepared) await store.put(toId, file.preparedKey, prepared.bytes, file.preparedMediaType ?? "image/png")
    }
  }
  return copied
}

function approvePath(campaignId: string): string {
  return `/app/campaigns/${campaignId}/order`
}

function dollarCents(formatted: string): number {
  const match = formatted.replace(/[$,]/g, "").match(/\d+(\.\d{1,2})?/)
  if (!match) return 0
  return Math.round(Number(match[0]) * 100)
}

function decodeFile(value: string): Buffer | null {
  if (!value || value.length > 12_000_000) return null
  const bytes = Buffer.from(value, "base64")
  if (bytes.length === 0 || bytes.length > 8 * 1024 * 1024) return null
  return bytes
}

function customerError(error: unknown): string {
  const message = error instanceof Error ? error.message : ""
  if (/not found/i.test(message)) return "That mailer was not found."
  if (/first screen|no longer available|Unapprove/i.test(message)) {
    return "This mailer already has a design. Duplicate it, or create a new one, before changing the design."
  }
  if (message && message.length < 280 && !leaksInternalText(message)) return message
  return "That step didn't finish. Nothing was mailed or charged."
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function text(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === "string" ? value.trim() : ""
}
