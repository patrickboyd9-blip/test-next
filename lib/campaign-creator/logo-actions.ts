"use server"

import { randomUUID } from "node:crypto"

import { getCampaignRepository } from "@/lib/campaign-creator/repository"
import { studioImagePublicPath } from "@/lib/campaign-creator/studio-image-paths"
import { resolveStudioImageStore } from "@/lib/campaign-creator/studio-image-store"
import type { BrandAsset, Campaign } from "@/lib/campaign-creator/types"

import { prepareCustomerLogo, removeLogoAsset, replaceLogoAsset } from "./customer-logo"

export type LogoActionResult =
  | { ok: true; campaign: Campaign }
  | { ok: false; error: string }

/**
 * Stores the customer's logo beside this campaign's other studio files and
 * records it on the brief. The photograph generator is not given the pixels.
 * There is still no account check on campaign id; this does not add one.
 */
export async function saveCampaignLogo(campaignId: string, formData: FormData): Promise<LogoActionResult> {
  const repository = getCampaignRepository()
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) return { ok: false, error: "That campaign could not be found." }

  const value = formData.get("logo")
  if (!value || typeof value === "string" || typeof value.arrayBuffer !== "function") {
    return { ok: false, error: "Choose a PNG or JPEG logo." }
  }
  const prepared = prepareCustomerLogo(new Uint8Array(await value.arrayBuffer()))
  if (!prepared.ok) return prepared

  const { store } = resolveStudioImageStore({})
  const fileUrl = await store.persistPng(campaignId, prepared.logo.fileName, prepared.logo.png)
  const asset: BrandAsset = {
    id: randomUUID(),
    type: "logo",
    description: value.name || "Logo",
    fileUrl: fileUrl || studioImagePublicPath(campaignId, prepared.logo.fileName),
  }
  const saved = await repository.updateBrief(campaignId, {
    brandAssets: replaceLogoAsset(campaign.brief.brandAssets, asset),
  })
  return { ok: true, campaign: saved }
}

export async function removeCampaignLogo(campaignId: string): Promise<LogoActionResult> {
  const repository = getCampaignRepository()
  const campaign = await repository.getCampaign(campaignId)
  if (!campaign) return { ok: false, error: "That campaign could not be found." }
  const saved = await repository.updateBrief(campaignId, {
    brandAssets: removeLogoAsset(campaign.brief.brandAssets),
  })
  return { ok: true, campaign: saved }
}
