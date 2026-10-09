import type { GeneratedAsset, ImageGenerationAdapter } from "./image-generation"
import { toImageBrief } from "./image-brief"
import { OpenAIImageGenerationNotConfiguredError } from "./openai-image-generation"
import {
  fingerprintForSpec,
  imageBriefContextFor,
  imageBriefFingerprint,
  type StudioImageRecord,
} from "./studio-image-fingerprint"
import { isSafeStudioId } from "./studio-image-paths"
import {
  resolveStudioImageStore,
  type StudioImageStore,
} from "./studio-image-store"
import type { CampaignBrief, CreativeSpec } from "./types"

/**
 * Sidecar cache for conceived photographs.
 * Not written onto Campaign or CreativeSpec. A cache hit is what Focus,
 * Compare, Refine, and Approve should render instead of the curated shelf.
 */

const inflight = new Map<string, Promise<StudioImageRecord | null>>()

export type StudioImageFallback = "not_configured" | "failed"

export interface StudioImageMiss {
  directionId: string
  fingerprint: string
  fallback: StudioImageFallback
}

export interface StudioImageLoad {
  records: StudioImageRecord[]
  misses: StudioImageMiss[]
  /** True while a photograph is still being made off the request path. */
  pending?: boolean
}

export async function ensureStudioDirectionImages(options: {
  campaignId: string
  entries: readonly { directionId: string; spec: CreativeSpec }[]
  campaignBrief?: CampaignBrief
  createAdapter: () => ImageGenerationAdapter
  cacheRoot?: string
  imageStore?: StudioImageStore
  dedupeScope?: string
}): Promise<StudioImageLoad> {
  if (!isSafeStudioId(options.campaignId)) {
    throw new Error("Invalid campaign id")
  }

  const { store, scope } = resolveStudioImageStore(options)
  let adapter: ImageGenerationAdapter | null = null
  const getAdapter = () => {
    if (!adapter) adapter = options.createAdapter()
    return adapter
  }

  const records: StudioImageRecord[] = []
  const misses: StudioImageMiss[] = []
  for (let index = 0; index < options.entries.length; index += 1) {
    const entry = options.entries[index]
    try {
      const record = await ensureOne({
        campaignId: options.campaignId,
        directionId: entry.directionId,
        spec: entry.spec,
        campaignBrief: options.campaignBrief,
        store,
        scope,
        getAdapter,
      })
      if (record) records.push(record)
    } catch (error) {
      if (error instanceof OpenAIImageGenerationNotConfiguredError) {
        misses.push(
          ...missesFor(options.entries.slice(index), options.campaignBrief, "not_configured")
        )
        return { records, misses }
      }
      console.error("Studio image generation failed:", error)
      const miss = missFor(entry, options.campaignBrief, "failed")
      if (miss) misses.push(miss)
    }
  }
  return { records, misses }
}

function missFor(
  entry: { directionId: string; spec: CreativeSpec },
  campaign: CampaignBrief | undefined,
  fallback: StudioImageFallback
): StudioImageMiss | null {
  const fingerprint = fingerprintForSpec(
    entry.spec,
    imageBriefContextFor(entry.directionId, campaign)
  )
  if (!fingerprint) return null
  return { directionId: entry.directionId, fingerprint, fallback }
}

function missesFor(
  entries: readonly { directionId: string; spec: CreativeSpec }[],
  campaign: CampaignBrief | undefined,
  fallback: StudioImageFallback
): StudioImageMiss[] {
  return entries.flatMap((entry) => {
    const miss = missFor(entry, campaign, fallback)
    return miss ? [miss] : []
  })
}

async function ensureOne(input: {
  campaignId: string
  directionId: string
  spec: CreativeSpec
  campaignBrief?: CampaignBrief
  store: StudioImageStore
  scope: string
  getAdapter: () => ImageGenerationAdapter
}): Promise<StudioImageRecord | null> {
  if (!isSafeStudioId(input.directionId)) return null
  const context = imageBriefContextFor(input.directionId, input.campaignBrief)
  const brief = toImageBrief(input.spec, context)
  if (!brief) return null

  const fingerprint = imageBriefFingerprint(brief)
  const key = `${input.scope}:${input.campaignId}:${input.directionId}:${fingerprint}`
  const pending = inflight.get(key)
  if (pending) return pending

  const work = loadOrGenerate({ ...input, fingerprint })
  inflight.set(key, work)
  try {
    return await work
  } finally {
    inflight.delete(key)
  }
}

async function loadOrGenerate(input: {
  campaignId: string
  directionId: string
  spec: CreativeSpec
  campaignBrief?: CampaignBrief
  store: StudioImageStore
  scope: string
  fingerprint: string
  getAdapter: () => ImageGenerationAdapter
}): Promise<StudioImageRecord | null> {
  const brief = toImageBrief(
    input.spec,
    imageBriefContextFor(input.directionId, input.campaignBrief)
  )
  if (!brief) return null

  const fileBase = `${input.directionId}--${input.fingerprint}`
  const cached = cachedRecord(
    await input.store.readSidecar(input.campaignId, fileBase),
    input.directionId,
    input.fingerprint
  )
  if (cached) return cached

  const generated = await input.getAdapter().generate(brief)
  const asset = await persistGeneratedAsset(generated, input.store, input.campaignId, fileBase)
  await input.store.writeSidecar(input.campaignId, fileBase, {
    fingerprint: input.fingerprint,
    asset,
  })
  return {
    directionId: input.directionId,
    fingerprint: input.fingerprint,
    asset,
  }
}

function cachedRecord(
  raw: { fingerprint?: string; asset?: GeneratedAsset } | null,
  directionId: string,
  fingerprint: string
): StudioImageRecord | null {
  if (!raw) return null
  if (raw.fingerprint !== fingerprint || !raw.asset?.src) return null
  if (raw.asset.sourceClass !== "generated") return null
  return { directionId, fingerprint, asset: raw.asset }
}

export async function persistGeneratedAsset(
  generated: GeneratedAsset,
  store: StudioImageStore,
  campaignId: string,
  fileBase: string
): Promise<GeneratedAsset> {
  if (!generated.src.startsWith("data:image/")) return generated
  const comma = generated.src.indexOf(",")
  if (comma < 0) return generated
  const bytes = Buffer.from(generated.src.slice(comma + 1), "base64")
  const src = await store.persistPng(campaignId, `${fileBase}.png`, bytes)
  return { ...generated, src }
}
