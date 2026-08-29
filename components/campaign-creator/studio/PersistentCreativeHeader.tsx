"use client"

import { useState } from "react"
import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { CreativeDirection, CreativeSpec } from "@/lib/campaign-creator/types"

import { PostcardPreview } from "./PostcardPreview"

interface PersistentCreativeHeaderProps {
  direction: CreativeDirection
  spec: CreativeSpec
  onEditCreative: () => void
  isEditing?: boolean
}

export function PersistentCreativeHeader({
  direction,
  spec,
  onEditCreative,
  isEditing = false,
}: PersistentCreativeHeaderProps) {
  const [showConfirm, setShowConfirm] = useState(false)

  function handleEditClick() {
    setShowConfirm(true)
  }

  function handleConfirmEdit() {
    setShowConfirm(false)
    onEditCreative()
  }

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-6 md:px-6">
      <div className="flex min-h-16 items-center gap-4">
        <div className="h-14 w-[84px] shrink-0 overflow-hidden rounded-md shadow-sm">
          <PostcardPreview
            spec={spec}
            size="thumbnail"
            enableHoverTilt={false}
            className="!max-w-none !h-full !aspect-auto"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{direction.name}</p>
          <p className="flex items-center gap-1 text-xs text-primary">
            <Check className="size-3.5" aria-hidden />
            Creative approved
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleEditClick}
          disabled={isEditing}
        >
          Edit creative
        </Button>
      </div>

      {showConfirm && (
        <div
          className="mt-3 rounded-lg border border-border bg-muted/30 p-4"
          role="dialog"
          aria-labelledby="edit-creative-confirm"
        >
          <p id="edit-creative-confirm" className="text-sm text-muted-foreground">
            You can still refine this design. You&apos;ll need to approve it again before
            launching.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleConfirmEdit} disabled={isEditing}>
              Continue editing
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
