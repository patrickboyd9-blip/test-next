import { randomUUID } from "crypto"

import { getActiveSpec, getApprovedSpec } from "./creative-state"
import { toImageBrief, type ImageBrief } from "./image-brief"
import type {
  GeneratedAsset,
  ImageGenerationAdapter,
  ImageGenerationOptions,
} from "./image-generation"
import {
  OpenAIImageGenerationNotConfiguredError,
  type OpenAIImageGenerationResult,
} from "./openai-image-generation"
import type { StudioImageTier } from "./openai-image-settings"
import {
  persistGeneratedAsset,
  type StudioImageFallback,
  type StudioImageLoad,
  type StudioImageMiss,
} from "./studio-image-cache"
import {
  imageBriefContextFor,
  imageBriefFingerprint,
  studioImageEntries,
  type StudioImageRecord,
} from "./studio-image-fingerprint"
import { isSafeStudioId } from "./studio-image-paths"
import {
  resolveStudioImageStore,
  type StudioImageSidecar,
  type StudioImageStore,
} from "./studio-image-store"
import type { CampaignBrief, CampaignCreative, CreativeSpec } from "./types"

/**
 * Photographs are not made inside the web request.
 *
 * Vercel Hobby without Fluid Compute rejects maxDuration above 60, and this
 * app stays at 60 so that deploy keeps working. next/server after() returns
 * the job record immediately and keeps the same invocation alive until the
 * picture finishes or the 60s cap kills it. @vercel/functions waitUntil is
 * the same mechanism with an extra package, so it is not used.
 *
 * One photograph is started per request. The browser polls. A killed run
 * leaves the job stale; the next poll retries it once. A picture that already
 * landed in storage is never generated again.
 */
const MAX_ATTEMPTS = 2
const STALE_MS = 75_000

interface WorkItem {
  directionId: string
  spec: CreativeSpec
  tier: StudioImageTier
}

interface PreparedSlot {
  item: WorkItem
  fingerprint: string
  fileBase: string
  sidecar: StudioImageSidecar | null
  phase: "ready" | "pending" | "due" | "failed"
}

export function studioImageFileBase(
  directionId: string,
  fingerprint: string,
  tier: StudioImageTier
): string {
  const base = `${directionId}--${fingerprint}`
  return tier === "final" ? `${base}--final` : base
}

export async function syncStudioDirectionImages(options: {
  campaignId: string
  creative: CampaignCreative
  campaignBrief?: CampaignBrief
  createAdapter: () => ImageGenerationAdapter
  cacheRoot?: string
  imageStore?: StudioImageStore
  dedupeScope?: string
  schedule?: (work: () => Promise<void>) => void
  /** Tests run the provider before returning. Production uses schedule. */
  runInline?: boolean
  now?: () => Date
  configured?: boolean
  env?: NodeJS.ProcessEnv
}): Promise<StudioImageLoad> {
  if (!isSafeStudioId(options.campaignId)) {
    throw new Error("Invalid campaign id")
  }

  const { store } = resolveStudioImageStore(options)
  const now = options.now ?? (() => new Date())
  const configured =
    options.configured ??
    Boolean((options.env ?? process.env).OPENAI_API_KEY?.trim())

  const read = () =>
    readStudioImageSlots({
      campaignId: options.campaignId,
      creative: options.creative,
      campaignBrief: options.campaignBrief,
      store,
      now: now(),
      configured,
    })

  const first = await read()
  const due = first.due
  if (!due) return first.load

  const work = () =>
    executeStudioImageJob({
      campaignId: options.campaignId,
      campaignBrief: options.campaignBrief,
      store,
      createAdapter: options.createAdapter,
      slot: due,
      now,
    })

  if (options.runInline) {
    await work()
    const second = await read()
    return second.load
  }

  options.schedule?.(work)
  return first.load
}

async function readStudioImageSlots(input: {
  campaignId: string
  creative: CampaignCreative
  campaignBrief?: CampaignBrief
  store: StudioImageStore
  now: Date
  configured: boolean
}): Promise<{ load: StudioImageLoad; due: PreparedSlot | null }> {
  const records: StudioImageRecord[] = []
  const misses: StudioImageMiss[] = []
  let pending = false
  let due: PreparedSlot | null = null

  for (const item of workItems(input.creative, input.campaignBrief)) {
    if (!isSafeStudioId(item.directionId)) continue
    const context = imageBriefContextFor(item.directionId, input.campaignBrief)
    const brief = toImageBrief(item.spec, context)
    if (!brief) continue
    const fingerprint = imageBriefFingerprint(brief)
    const fileBase = studioImageFileBase(item.directionId, fingerprint, item.tier)
    const sidecar = await input.store.readSidecar(input.campaignId, fileBase)
    const slot: PreparedSlot = {
      item,
      fingerprint,
      fileBase,
      sidecar,
      phase: phaseFor(sidecar, fingerprint, input.now.getTime()),
    }

    if (slot.phase === "ready" && sidecar?.asset) {
      records.push({
        directionId: item.directionId,
        fingerprint,
        asset: sidecar.asset,
        tier: item.tier,
      })
      continue
    }

    if (!input.configured) {
      misses.push(miss(item.directionId, fingerprint, "not_configured"))
      continue
    }

    if (slot.phase === "failed") {
      misses.push(
        miss(
          item.directionId,
          fingerprint,
          sidecar?.error === "not_configured" ? "not_configured" : "failed"
        )
      )
      continue
    }

    if (slot.phase === "pending") {
      pending = true
      continue
    }

    pending = true
    if (!due) due = slot
  }

  return { load: { records, misses, pending }, due }
}

function workItems(
  creative: CampaignCreative,
  brief: CampaignBrief | undefined
): WorkItem[] {
  const previews: WorkItem[] = studioImageEntries(creative, brief).map((entry) => ({
    directionId: entry.directionId,
    spec: entry.spec,
    tier: "preview",
  }))
  const selected = creative.selectedDirectionId
  if (!selected) return previews
  const spec = getApprovedSpec(creative) ?? getActiveSpec(creative, selected)
  if (!spec) return previews
  return [...previews, { directionId: selected, spec, tier: "final" }]
}

function phaseFor(
  sidecar: StudioImageSidecar | null,
  fingerprint: string,
  nowMs: number
): PreparedSlot["phase"] {
  if (finishedAsset(sidecar, fingerprint)) return "ready"
  if (sidecar?.error === "not_configured") return "failed"
  const attempts = sidecar?.attempts ?? 0
  if (sidecar?.status === "running" && claimedFresh(sidecar.claimedAt, nowMs)) {
    return "pending"
  }
  if (attempts >= MAX_ATTEMPTS) return "failed"
  return "due"
}

function finishedAsset(
  sidecar: StudioImageSidecar | null,
  fingerprint: string
): GeneratedAsset | null {
  if (!sidecar?.asset?.src) return null
  if (sidecar.fingerprint !== fingerprint) return null
  if (sidecar.asset.sourceClass !== "generated") return null
  return sidecar.asset
}

function claimedFresh(claimedAt: string | undefined, nowMs: number): boolean {
  if (!claimedAt) return false
  const then = Date.parse(claimedAt)
  if (Number.isNaN(then)) return false
  return nowMs - then < STALE_MS
}

function miss(
  directionId: string,
  fingerprint: string,
  fallback: StudioImageFallback
): StudioImageMiss {
  return { directionId, fingerprint, fallback }
}

async function executeStudioImageJob(input: {
  campaignId: string
  campaignBrief?: CampaignBrief
  store: StudioImageStore
  createAdapter: () => ImageGenerationAdapter
  slot: PreparedSlot
  now: () => Date
}): Promise<void> {
  const { slot } = input
  const existing = await input.store.readSidecar(input.campaignId, slot.fileBase)
  if (finishedAsset(existing, slot.fingerprint)) return

  const claimedAt = input.now().toISOString()
  const claim = randomUUID()
  const lockBase = `claim--${slot.fileBase}`
  const lock = await input.store.readSidecar(input.campaignId, lockBase)
  if (lock?.claim && claimedFresh(lock.claimedAt, Date.parse(claimedAt))) return
  if (lock) await input.store.deleteSidecar(input.campaignId, lockBase)

  const created = await input.store.createSidecar(input.campaignId, lockBase, {
    fingerprint: slot.fingerprint,
    tier: slot.item.tier,
    status: "running",
    claim,
    claimedAt,
  })
  if (!created) return

  const attempts = (existing?.attempts ?? 0) + 1
  const running: StudioImageSidecar = {
    fingerprint: slot.fingerprint,
    tier: slot.item.tier,
    status: "running",
    attempts,
    asset: existing?.asset,
    claim,
    claimedAt,
  }
  await input.store.writeSidecar(input.campaignId, slot.fileBase, running)

  try {
    const brief = toImageBrief(
      slot.item.spec,
      imageBriefContextFor(slot.item.directionId, input.campaignBrief)
    )
    if (!brief) {
      await input.store.writeSidecar(input.campaignId, slot.fileBase, {
        ...running,
        status: "failed",
        attempts: MAX_ATTEMPTS,
        error: "failed",
      })
      return
    }

    const adapter = input.createAdapter()
    const generated = await generateImage(adapter, brief, {
      tier: slot.item.tier,
      campaignId: input.campaignId,
      directionId: slot.item.directionId,
    })
    const asset = await persistGeneratedAsset(
      generated.asset,
      input.store,
      input.campaignId,
      slot.fileBase
    )
    const alternates: GeneratedAsset[] = []
    for (let index = 0; index < generated.alternates.length; index += 1) {
      alternates.push(
        await persistGeneratedAsset(
          generated.alternates[index]!,
          input.store,
          input.campaignId,
          `${slot.fileBase}--alt${index}`
        )
      )
    }
    await input.store.writeSidecar(input.campaignId, slot.fileBase, {
      fingerprint: slot.fingerprint,
      tier: slot.item.tier,
      status: "ready",
      attempts,
      asset,
      alternates: alternates.length > 0 ? alternates : undefined,
      claim,
      claimedAt,
    })
  } catch (error) {
    const notConfigured = error instanceof OpenAIImageGenerationNotConfiguredError
    const exhausted = notConfigured || attempts >= MAX_ATTEMPTS
    await input.store.writeSidecar(input.campaignId, slot.fileBase, {
      fingerprint: slot.fingerprint,
      tier: slot.item.tier,
      status: exhausted ? "failed" : "queued",
      attempts: notConfigured ? MAX_ATTEMPTS : attempts,
      error: notConfigured ? "not_configured" : "failed",
      asset: existing?.asset,
      claim,
      claimedAt,
    })
    if (!notConfigured) console.error("Studio image generation failed:", error)
  } finally {
    const currentLock = await input.store.readSidecar(input.campaignId, lockBase)
    if (currentLock?.claim === claim) {
      await input.store.deleteSidecar(input.campaignId, lockBase)
    }
  }
}

async function generateImage(
  adapter: ImageGenerationAdapter,
  brief: ImageBrief,
  options: ImageGenerationOptions
): Promise<OpenAIImageGenerationResult> {
  const detailed = adapter as ImageGenerationAdapter & {
    generateDetailed?: (
      brief: ImageBrief,
      options?: ImageGenerationOptions
    ) => Promise<OpenAIImageGenerationResult>
  }
  if (typeof detailed.generateDetailed === "function") {
    return detailed.generateDetailed(brief, options)
  }
  return { asset: await adapter.generate(brief, options), alternates: [], usage: null }
}
