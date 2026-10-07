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

/**
 * Loads cached photographs for the current directions.
 * A miss generates once and is reused by Focus, Compare, Refine, and Approve.
 * While a photograph should still succeed, callers must not show the beta shelf.
 */
export function useStudioDirectionImages(campaign: Campaign): StudioImageState {
  const key = studioImageRequestKey(campaign.creative, campaign.brief)
  const directionCount = campaign.creative.directions.length
  const [cache, setCache] = useState<{
    key: string
    records: StudioImageState["records"]
    misses: StudioImageState["misses"]
    requestFailed?: boolean
  } | null>(null)

  useEffect(() => {
    if (directionCount === 0) return

    let cancelled = false
    void loadStudioDirectionImages(campaign.id)
      .then((next) => {
        if (!cancelled) {
          setCache({
            key,
            records: next.records,
            misses: next.misses,
          })
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Studio image cache failed:", error)
          setCache({ key, records: [], misses: [], requestFailed: true })
        }
      })

    return () => {
      cancelled = true
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
  return {
    records: cache.records,
    misses: cache.misses,
    phase: "ready",
    requestFailed: cache.requestFailed,
  }
}
