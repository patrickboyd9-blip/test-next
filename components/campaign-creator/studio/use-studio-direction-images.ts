"use client"

import { useEffect, useState } from "react"

import { loadStudioDirectionImages } from "@/lib/campaign-creator/actions"
import {
  studioImageRequestKey,
  type StudioImageRecord,
} from "@/lib/campaign-creator/studio-image-fingerprint"
import type { Campaign } from "@/lib/campaign-creator/types"

/**
 * Loads cached photographs for the current directions.
 * A miss generates once and is reused by Focus, Compare, Refine, and Approve.
 */
export function useStudioDirectionImages(campaign: Campaign): StudioImageRecord[] {
  const key = studioImageRequestKey(campaign.creative)
  const directionCount = campaign.creative.directions.length
  const [cache, setCache] = useState<{
    key: string
    records: StudioImageRecord[]
  } | null>(null)

  useEffect(() => {
    if (directionCount === 0) return

    let cancelled = false
    void loadStudioDirectionImages(campaign.id)
      .then((next) => {
        if (!cancelled) setCache({ key, records: next })
      })
      .catch((error) => {
        if (!cancelled) console.error("Studio image cache failed:", error)
      })

    return () => {
      cancelled = true
    }
  }, [campaign.id, key, directionCount])

  if (directionCount === 0) return []
  if (cache?.key !== key) return []
  return cache.records
}
