"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { CampaignAccessError, requireOwnedCampaign } from "@/lib/auth/campaign-access"
import { getSession } from "@/lib/auth/session"
import { getCampaignRepository } from "@/lib/campaign-creator/repository"
import { resolveStudioImageStore } from "@/lib/campaign-creator/studio-image-store"
import type { JobCreative, JobKeepBox, JobPhotoRecord, JobProtect } from "@/lib/campaign-creator/types"

import { prepareJobPhoto } from "./prepare"

export type JobActionResult = { ok: true; creative: JobCreative } | { ok: false; error: string }

export async function addJobPhotoAction(campaignId: string, formData: FormData): Promise<void> {
  const campaign = await owned(campaignId)
  const creative = campaign.jobCreative ?? emptyCreative()
  const back = `/app/campaigns/${campaignId}/job-photos`
  if (!creative.rightsConfirmedAt && formData.get("rights") !== "yes") {
    redirect(`${back}?error=${encodeURIComponent("Confirm you have permission to mail these photos.")}`)
  }
  if (creative.photos.length >= 5) {
    redirect(`${back}?error=${encodeURIComponent("Five job photos is the limit.")}`)
  }
  const value = formData.get("photo")
  if (!value || typeof value === "string" || typeof value.arrayBuffer !== "function") {
    redirect(`${back}?error=${encodeURIComponent("Choose a PNG or JPEG from the job.")}`)
  }
  const prepared = prepareJobPhoto(new Uint8Array(await value.arrayBuffer()), value.type || "")
  if (!prepared.ok) redirect(`${back}?error=${encodeURIComponent(prepared.error)}`)
  if (creative.photos.some((photo) => photo.id === prepared.record.id)) {
    redirect(`${back}?error=${encodeURIComponent("That photo is already on this campaign.")}`)
  }
  const { store } = resolveStudioImageStore({})
  await store.persistPng(campaignId, prepared.record.fileName, prepared.png)
  const photo: JobPhotoRecord = { ...prepared.record, createdAt: new Date().toISOString() }
  const next: JobCreative = {
    ...creative,
    rightsConfirmedAt: creative.rightsConfirmedAt ?? new Date().toISOString(),
    photos: [...creative.photos, photo],
    frontPhotoId: creative.frontPhotoId ?? photo.id,
  }
  await getCampaignRepository().saveJobCreative(campaignId, next)
  revalidatePath(back)
  redirect(back)
}

export async function saveJobLayoutAction(campaignId: string, input: JobCreative): Promise<JobActionResult> {
  const campaign = await owned(campaignId)
  const current = campaign.jobCreative
  if (!current) return { ok: false, error: "Add a job photo before saving the frame." }
  const cleaned = sanitizeLayout(current, input)
  if ("error" in cleaned) return { ok: false, error: cleaned.error }
  const saved = await getCampaignRepository().saveJobCreative(campaignId, cleaned)
  revalidatePath(`/app/campaigns/${campaignId}/job-photos`)
  return { ok: true, creative: saved.jobCreative ?? cleaned }
}

function sanitizeLayout(current: JobCreative, input: JobCreative): JobCreative | { error: string } {
  if (!current.rightsConfirmedAt && !input.rightsConfirmedAt) {
    return { error: "Confirm you have permission to mail these photos." }
  }
  const trade = (input.trade || "").trim().slice(0, 80) || "unknown"
  const serviceAction = (input.serviceAction || "").trim().slice(0, 120)
  if (!serviceAction) return { error: "Say what the photo shows, such as a repair or a replacement." }
  const photos = current.photos.map((photo) => {
    const edited = input.photos.find((item) => item.id === photo.id && item.role === "job-photo")
    const keep = clampKeep(edited?.keep ?? photo.keep)
    const protect = edited?.protect ?? photo.protect
    return { ...photo, keep, protect: validProtect(protect) }
  })
  const frontPhotoId = photos.some((photo) => photo.id === input.frontPhotoId) ? input.frontPhotoId : photos[0]?.id ?? null
  const treatment = input.back?.treatment === "photo" ? "photo" : "text"
  const backPhotoId = treatment === "photo" && photos.some((photo) => photo.id === input.back?.photoId) ? input.back.photoId : null
  return {
    rightsConfirmedAt: current.rightsConfirmedAt ?? new Date().toISOString(),
    trade,
    serviceAction,
    photos,
    frontPhotoId,
    back: { treatment, photoId: backPhotoId },
  }
}

function clampKeep(keep: JobKeepBox | undefined): JobKeepBox {
  const x = clamp(keep?.x ?? 0.2, 0, 0.9)
  const y = clamp(keep?.y ?? 0.12, 0, 0.9)
  const w = clamp(keep?.w ?? 0.6, 0.08, 1 - x)
  const h = clamp(keep?.h ?? 0.62, 0.08, 1 - y)
  return { x, y, w, h }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function validProtect(value: JobProtect | undefined): JobProtect {
  if (value === "face" || value === "service-object" || value === "both" || value === "unspecified") return value
  return "unspecified"
}

function emptyCreative(): JobCreative {
  return {
    rightsConfirmedAt: null,
    trade: "unknown",
    serviceAction: "",
    photos: [],
    frontPhotoId: null,
    back: { treatment: "text", photoId: null },
  }
}

async function owned(campaignId: string) {
  const session = await getSession()
  if (!session) throw new CampaignAccessError(401, "Sign in required.")
  return requireOwnedCampaign(campaignId)
}
