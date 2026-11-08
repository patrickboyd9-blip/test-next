import type { Campaign, UploadedDesign, UploadedDesignFile } from "@/lib/campaign-creator/types"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"

import { sniffDesignMedia } from "./decode-raster"
import { prepareDesignFace } from "./prepare-face"
import { preflightDesignFile, type DesignFace, type DesignPreflightIssue } from "./preflight"
import {
  openUploadedDesign,
  preparedDesignKey,
  resolveUploadedDesignStore,
  uploadedDesignKey,
  type UploadedDesignStore,
} from "./store"

export async function saveDesignFace(input: {
  campaign: Campaign
  face: DesignFace
  fileName: string
  bytes: Buffer
  declaredType: string
  store?: UploadedDesignStore
}): Promise<UploadedDesign> {
  const store = input.store ?? resolveUploadedDesignStore()
  const media = sniffDesignMedia(input.bytes, input.declaredType)
  const tooLarge = input.bytes.byteLength > 8 * 1024 * 1024 || input.bytes.byteLength === 0
  if (!media || tooLarge) {
    const issues = await preflightDesignFile({
      bytes: input.bytes,
      declaredType: input.declaredType,
      face: input.face,
    })
    return mergeDesign(input.campaign.uploadedDesign, input.face, undefined, issues)
  }

  const key = uploadedDesignKey(input.face, media)
  await store.put(input.campaign.id, key, input.bytes, media)
  const file: UploadedDesignFile = {
    fileName: input.fileName.slice(0, 180) || key,
    mediaType: media,
    byteLength: input.bytes.byteLength,
    key,
  }
  const next = mergeDesign(input.campaign.uploadedDesign, input.face, file, [])
  next.issues = await prepareStoredDesign(input.campaign.id, next, store)
  next.checkedAt = new Date().toISOString()
  next.approvedAt = undefined
  next.printFileKey = undefined
  return next
}

function mergeDesign(
  current: UploadedDesign | undefined,
  face: DesignFace,
  file: UploadedDesignFile | undefined,
  faceIssues: DesignPreflightIssue[]
): UploadedDesign {
  const next: UploadedDesign = {
    front: current?.front,
    back: current?.back,
    issues: (current?.issues ?? []).filter((item) => item.face !== face),
    checkedAt: current?.checkedAt,
  }
  if (file) next[face] = file
  else delete next[face]
  next.issues = [...next.issues, ...faceIssues]
  return next
}

async function prepareStoredDesign(
  campaignId: string,
  design: UploadedDesign,
  store: UploadedDesignStore
): Promise<DesignPreflightIssue[]> {
  const geometry = buildPostcard5x8PrintSpec()
  const issues: DesignPreflightIssue[] = []
  for (const face of ["front", "back"] as const) {
    const file = design[face]
    if (!file) continue
    const stored = await store.get(campaignId, file.key)
    const opened = stored ?? (await openUploadedDesign(campaignId, file.key))
    if (!opened) {
      issues.push({
        face,
        severity: "error",
        code: "unreadable",
        message: "That file could not be read. Upload it again.",
      })
      continue
    }
    const checked = await preflightDesignFile({
      bytes: opened.bytes,
      declaredType: file.mediaType,
      face,
    })
    const fatal = checked.some(
      (item) =>
        item.severity === "error" &&
        (item.code === "unreadable" || item.code === "page_count" || item.code === "file_type" || item.code === "file_size")
    )
    if (fatal) {
      issues.push(...checked.filter((item) => item.code !== "page_size" && item.code !== "resolution"))
      continue
    }
    const prepared = await prepareDesignFace({
      bytes: opened.bytes,
      declaredType: file.mediaType,
      face,
      geometry,
    })
    if (!prepared.ok) {
      issues.push({ face, severity: "error", code: "unreadable", message: prepared.error })
      continue
    }
    const preparedKey = preparedDesignKey(face, prepared.prepared.mediaType)
    await store.put(campaignId, preparedKey, prepared.prepared.bytes, prepared.prepared.mediaType)
    file.preparedKey = preparedKey
    file.preparedMediaType = prepared.prepared.mediaType
    issues.push(
      ...checked.filter((item) => {
        if (item.code === "page_size" || item.code === "resolution") return false
        if (item.code === "keep_out" && prepared.prepared.address !== "unknown") return false
        return true
      }),
      ...prepared.prepared.issues
    )
  }
  return issues
}
