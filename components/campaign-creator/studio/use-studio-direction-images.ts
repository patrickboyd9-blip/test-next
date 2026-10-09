"use client"

import { useEffect, useState } from "react"

import { loadStudioDirectionImages } from "@/lib/campaign-creator/actions"
import { studioImageRequestKey } from "@/lib/campaign-creator/studio-image-fingerprint"
import type { StudioImageState } from "@/lib/campaign-creator/studio-photo"
import type { Campaign } from "@/lib/campaign-creator/types"

const EMPTY: StudioImageState = {
  records: [],
  misses: [],
  phase: "ready",
}

const POLL_MS = 2500

/**
 * Starts photograph jobs and polls until each one is saved or has failed.
 * The request itself does not wait for OpenAI. A preview stays on screen
 * while the print-size photograph for the chosen direction is still running.
 */
export function useStudioDirectionImages(campaign: Campaign): StudioImageState {
  const key = [
    studioImageRequestKey(campaign.creative, campaign.brief),
    campaign.creative.selectedDirectionId ?? "",
    campaign.status,
  ].join("|")
  const directionCount = campaign.creative.directions.length
  const [cache, setCache] = useState<{
    key: string
    records: StudioImageState["records"]
    misses: StudioImageState["misses"]
    pending?: boolean
    requestFailed?: boolean
  } | null>(null)

  useEffect(() => {
    if (directionCount === 0) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0

    const tick = () => {
      void loadStudioDirectionImages(campaign.id)
        .then((next) => {
          if (cancelled) return
          failures = 0
          setCache({
            key,
            records: next.records,
            misses: next.misses,
            pending: next.pending,
          })
          if (next.pending) {
            timer = setTimeout(tick, POLL_MS)
          }
        })
        .catch((error) => {
          if (cancelled) return
          console.error("Studio image cache failed:", error)
          failures += 1
          if (failures < 3) {
            timer = setTimeout(tick, POLL_MS)
            return
          }
          setCache({ key, records: [], misses: [], requestFailed: true })
        })
    }

    tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [campaign.id, key, directionCount])

  if (directionCount === 0) return EMPTY
  if (!cache || cache.key !== key) {
    return {
      records: cache?.records ?? [],
      misses: [],
      phase: "loading",
    }
  }
  if (cache.pending) {
    return {
      records: cache.records,
      misses: [],
      phase: "loading",
    }
  }
  return {
    records: cache.records,
    misses: cache.misses,
    phase: "ready",
    requestFailed: cache.requestFailed,
  }
}
