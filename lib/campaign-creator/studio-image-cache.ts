import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import type { GeneratedAsset, ImageGenerationAdapter } from "./image-generation"
import { toImageBrief } from "./image-brief"
import { OpenAIImageGenerationNotConfiguredError } from "./openai-image-generation"
import {
  imageBriefFingerprint,
  type StudioImageRecord,
} from "./studio-image-fingerprint"
import {
  defaultStudioImageCacheRoot,
  isSafeStudioId,
  studioImagePublicPath,
} from "./studio-image-paths"
import type { CreativeSpec } from "./types"

/**
 * Sidecar cache for conceived photographs.
 * Not written onto Campaign or CreativeSpec. A cache hit is what Focus,
 * Compare, Refine, and Approve should render instead of the curated shelf.
 */

const inflight = new Map<string, Promise<StudioImageRecord | null>>()

export async function ensureStudioDirectionImages(options: {
  campaignId: string
  entries: readonly { directionId: string; spec: CreativeSpec }[]
  createAdapter: () => ImageGenerationAdapter
  cacheRoot?: string
}): Promise<StudioImageRecord[]> {
  if (!isSafeStudioId(options.campaignId)) {
    throw new Error("Invalid campaign id")
  }

  const cacheRoot = options.cacheRoot ?? defaultStudioImageCacheRoot()
  let adapter: ImageGenerationAdapter | null = null
  const getAdapter = () => {
    if (!adapter) adapter = options.createAdapter()
    return adapter
  }

  const records: StudioImageRecord[] = []
  for (const entry of options.entries) {
    try {
      const record = await ensureOne({
        campaignId: options.campaignId,
        directionId: entry.directionId,
        spec: entry.spec,
        cacheRoot,
        getAdapter,
      })
      if (record) records.push(record)
    } catch (error) {
      if (error instanceof OpenAIImageGenerationNotConfiguredError) return records
      console.error("Studio image generation failed:", error)
    }
  }
  return records
}

async function ensureOne(input: {
  campaignId: string
  directionId: string
  spec: CreativeSpec
  cacheRoot: string
  getAdapter: () => ImageGenerationAdapter
}): Promise<StudioImageRecord | null> {
  if (!isSafeStudioId(input.directionId)) return null
  const brief = toImageBrief(input.spec)
  if (!brief) return null

  const fingerprint = imageBriefFingerprint(brief)
  const key = `${input.cacheRoot}:${input.campaignId}:${input.directionId}:${fingerprint}`
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
  cacheRoot: string
  fingerprint: string
  getAdapter: () => ImageGenerationAdapter
}): Promise<StudioImageRecord | null> {
  const brief = toImageBrief(input.spec)
  if (!brief) return null

  const fileBase = `${input.directionId}--${input.fingerprint}`
  const jsonPath = path.join(input.cacheRoot, input.campaignId, `${fileBase}.json`)
  const cached = await readCachedRecord(jsonPath, input.directionId, input.fingerprint)
  if (cached) return cached

  const generated = await input.getAdapter().generate(brief)
  const asset = await persistAsset(generated, {
    cacheRoot: input.cacheRoot,
    campaignId: input.campaignId,
    fileBase,
  })
  await mkdir(path.dirname(jsonPath), { recursive: true })
  await writeFile(
    jsonPath,
    JSON.stringify({ fingerprint: input.fingerprint, asset })
  )
  return {
    directionId: input.directionId,
    fingerprint: input.fingerprint,
    asset,
  }
}

async function readCachedRecord(
  jsonPath: string,
  directionId: string,
  fingerprint: string
): Promise<StudioImageRecord | null> {
  try {
    const raw = JSON.parse(await readFile(jsonPath, "utf8")) as {
      fingerprint?: string
      asset?: GeneratedAsset
    }
    if (raw.fingerprint !== fingerprint || !raw.asset?.src) return null
    if (raw.asset.sourceClass !== "generated") return null
    return { directionId, fingerprint, asset: raw.asset }
  } catch {
    return null
  }
}

async function persistAsset(
  generated: GeneratedAsset,
  location: { cacheRoot: string; campaignId: string; fileBase: string }
): Promise<GeneratedAsset> {
  if (!generated.src.startsWith("data:image/")) return generated
  const comma = generated.src.indexOf(",")
  if (comma < 0) return generated
  const bytes = Buffer.from(generated.src.slice(comma + 1), "base64")
  const fileName = `${location.fileBase}.png`
  const filePath = path.join(location.cacheRoot, location.campaignId, fileName)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, bytes)
  return {
    ...generated,
    src: studioImagePublicPath(location.campaignId, fileName),
  }
}
