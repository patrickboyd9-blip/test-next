import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import { saveDesignFace } from "@/lib/bring-your-own-design/save-face"
import type { UploadedDesignStore } from "@/lib/bring-your-own-design/store"
import { getCampaignRepository, type CampaignRepository } from "@/lib/campaign-creator/repository"
import type { Campaign } from "@/lib/campaign-creator/types"
import { principalFromAuthorization } from "@/lib/mcp/http"
import { getSession } from "@/lib/auth/session"
import { requireRate } from "@/lib/ops/rate-limit"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"
import { createNeonExecutor, defaultDocumentDirectory, postgresUrl } from "@/lib/storage/document-store"

export class PluginAuthError extends Error {
  constructor() {
    super("Sign in required.")
    this.name = "PluginAuthError"
  }
}

export async function pluginUserId(request: Request): Promise<string | null> {
  const token = await principalFromAuthorization(request.headers.get("authorization"))
  if (token) return token.userId
  const session = await getSession()
  return session?.userId ?? null
}

export async function requirePluginUser(request: Request): Promise<string> {
  const userId = await pluginUserId(request)
  if (!userId) throw new PluginAuthError()
  await requireRate(`create:${userId}`)
  return userId
}

export async function createPluginCampaign(
  userId: string,
  input: { name?: string; size?: string; brief?: string },
  repository: CampaignRepository = getCampaignRepository(),
): Promise<{ id: string; name: string; size: "5x8" | "6x9" }> {
  const name = input.name?.trim() ?? ""
  const size = input.size
  const brief = input.brief?.trim() || "A postcard designed for Modern Mail."
  if (!name) throw new Error("Add a campaign name.")
  if (size !== "5x8" && size !== "6x9") throw new Error("Choose a 5×8 or 6×9 postcard.")
  const campaign = await repository.createCampaign(userId)
  await repository.updateBrief(campaign.id, { goal: brief.slice(0, 4000) })
  const saved = await repository.setMailerFacts(campaign.id, { name, postcardSize: size })
  return { id: saved.id, name: saved.name || name, size }
}

export function campaignSummary(campaign: Campaign): { id: string; name: string; size: string | null } | null {
  if (!campaign.ownerId) return null
  return { id: campaign.id, name: campaign.name || "Untitled mailer", size: campaign.postcardSize ?? null }
}

export function summariesForOwner(documents: unknown[], userId: string): { id: string; name: string; size: string | null }[] {
  const found: { id: string; name: string; size: string | null }[] = []
  for (const document of documents) {
    if (!document || typeof document !== "object") continue
    const campaign = document as Campaign
    if (campaign.ownerId !== userId) continue
    const summary = campaignSummary(campaign)
    if (summary) found.push(summary)
  }
  return found.slice(0, 40)
}

export async function listPluginCampaigns(userId: string): Promise<{ id: string; name: string; size: string | null }[]> {
  const url = postgresUrl()
  if (url) {
    try {
      const rows = await createNeonExecutor(url).query<{ data: unknown }>(
        `SELECT data FROM campaigns WHERE data->>'ownerId' = $1 ORDER BY updated_at DESC LIMIT 40`,
        [userId],
      )
      return summariesForOwner(rows.map((row) => row.data), userId)
    } catch {
      return []
    }
  }
  const directory = defaultDocumentDirectory("campaigns")
  let names: string[] = []
  try {
    names = await readdir(directory)
  } catch {
    return []
  }
  const documents: unknown[] = []
  for (const name of names) {
    if (!name.endsWith(".json")) continue
    try {
      documents.push(JSON.parse(await readFile(path.join(directory, name), "utf8")) as unknown)
    } catch {
      continue
    }
  }
  return summariesForOwner(documents, userId)
}

export async function uploadPluginDesign(
  userId: string,
  input: {
    campaignId?: string
    face?: string
    fileName?: string
    contentBase64?: string
    businessName?: string
    street?: string
    city?: string
    state?: string
    postalCode?: string
  },
  repository: CampaignRepository = getCampaignRepository(),
  store?: UploadedDesignStore,
): Promise<{ campaignId: string; face: string; issues: { face: string; message: string }[]; mailed: false; charged: false }> {
  const campaign = await repository.getCampaign(input.campaignId ?? "")
  if (!campaign || campaign.ownerId !== userId) throw new Error("That mailer was not found.")
  const face = input.face
  if (face !== "front" && face !== "back") throw new Error("Choose the front or the back.")
  const bytes = decodeFile(input.contentBase64 ?? "")
  if (!bytes) throw new Error("That file is empty or too large. Use a PDF under 8 MB.")
  if (campaign.designSource === "studio") {
    throw new Error("This mailer already has a design. Create a new mailer to upload this one.")
  }
  if (campaign.designSource !== "upload") {
    await repository.beginUploadPath(campaign.id, {
      campaignName: campaign.name ?? "Mailer",
      businessName: input.businessName ?? "",
      street: input.street ?? "",
      city: input.city ?? "",
      state: input.state ?? "",
      postalCode: input.postalCode ?? "",
    })
  }
  const current = await repository.getCampaign(campaign.id)
  if (!current || current.ownerId !== userId) throw new Error("That mailer was not found.")
  const geometry = current.postcardSize === "6x9" ? buildPostcard6x9PrintSpec() : undefined
  const design = await saveDesignFace({
    campaign: current,
    face,
    fileName: input.fileName?.trim() || `${face}.pdf`,
    bytes,
    declaredType: mediaTypeForName(input.fileName ?? ""),
    store,
    geometry,
  })
  const saved = await repository.saveUploadedDesign(current.id, design)
  return {
    campaignId: saved.id,
    face,
    issues: (saved.uploadedDesign?.issues ?? []).map((issue) => ({ face: issue.face, message: publicMessage(issue.message) })),
    mailed: false,
    charged: false,
  }
}

function mediaTypeForName(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith(".pdf")) return "application/pdf"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  return ""
}

function decodeFile(value: string): Buffer | null {
  if (!value || value.length > 12_000_000) return null
  const bytes = Buffer.from(value, "base64")
  if (bytes.length === 0 || bytes.length > 8 * 1024 * 1024) return null
  return bytes
}

function publicMessage(message: string): string {
  return message.replace(/click\s*2\s*mail/gi, "the printer")
}
