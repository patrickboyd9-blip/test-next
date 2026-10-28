"use client"

import { useEffect, useState } from "react"

import type { Campaign, UploadedDesignIssue } from "@/lib/campaign-creator/types"
import type { PostcardSizeId } from "@/lib/postcard-layouts/ids"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { IssueLine } from "./upload/IssueLine"
import { ProofFrame } from "./upload/ProofFrame"

/**
 * The approved AI postcard at print size: the same proof the upload flow shows,
 * fed with the real print file (front page, back page) instead of the thumbnails.
 */
export function AiPrintProof({ campaign }: { campaign: Campaign }) {
  const [issues, setIssues] = useState<UploadedDesignIssue[]>([])
  const [size, setSize] = useState<PostcardSizeId>(
    campaign.mailPiece?.spec.designRationale?.format?.trim === "6x9" ? "6x9" : "5x8"
  )
  const version = encodeURIComponent(campaign.updatedAt)
  useEffect(() => {
    let live = true
    fetch(`/api/campaigns/${campaign.id}/print-proof/check?v=${version}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { issues?: UploadedDesignIssue[]; size?: PostcardSizeId } | null) => {
        if (!live || !body) return
        setIssues(body.issues ?? [])
        if (body.size) setSize(body.size)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [campaign.id, version])

  return (
    <div className="mb-6 flex flex-col gap-4">
      {issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Check these before you print</CardTitle>
            <CardDescription>You can still continue. Read these first.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {issues.map((item) => (
              <IssueLine key={`${item.face}-${item.code}-${item.message}`} issue={item} />
            ))}
          </CardContent>
        </Card>
      )}
      <h3 className="text-base font-medium">Proof</h3>
      <p className="text-sm leading-6 text-muted-foreground">
        The black line is where the card is cut. On the back, the shaded box is the address,
        postage, and barcode. Anything in that box will not show.
      </p>
      <div className="grid gap-6">
        <ProofFrame
          label="Front"
          face="front"
          size={size}
          mediaType="application/pdf"
          src={`/api/campaigns/${campaign.id}/print-proof/front?v=${version}`}
        />
        <ProofFrame
          label="Back"
          face="back"
          size={size}
          mediaType="application/pdf"
          src={`/api/campaigns/${campaign.id}/print-proof/back?v=${version}`}
        />
      </div>
    </div>
  )
}
