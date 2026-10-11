"use client"

import { useState } from "react"

import { chooseDesignPath } from "@/lib/bring-your-own-design/actions"
import type { Campaign } from "@/lib/campaign-creator/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface DesignPathChoiceProps {
  campaignId: string
  onCampaign: (campaign: Campaign) => void
}

export function DesignPathChoice({ campaignId, onCampaign }: DesignPathChoiceProps) {
  const [pending, setPending] = useState<"studio" | "upload" | null>(null)

  async function choose(source: "studio" | "upload") {
    setPending(source)
    try {
      const updated = await chooseDesignPath(campaignId, source)
      onCampaign(updated)
    } finally {
      setPending(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>How should this postcard be designed?</CardTitle>
        <CardDescription>
          You can design it here, or upload a front and back you made in Figma, Canva, or Photoshop.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => void choose("studio")} disabled={pending !== null}>
          {pending === "studio" ? "Opening studio…" : "Design it here"}
        </Button>
        <Button variant="outline" onClick={() => void choose("upload")} disabled={pending !== null}>
          {pending === "upload" ? "Opening upload…" : "I already have a design"}
        </Button>
      </CardContent>
    </Card>
  )
}
