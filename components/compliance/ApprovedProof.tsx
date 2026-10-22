"use client"

import { toCreativeCanvas } from "@/lib/campaign-creator/creative-canvas"
import { presentStudioPhoto } from "@/lib/campaign-creator/studio-photo"
import type { StudioImageState } from "@/lib/campaign-creator/studio-photo"
import { postcardIdentityFromBrief, type PostcardIdentity } from "@/lib/campaign-creator/studio-contact"
import type { Campaign } from "@/lib/campaign-creator/types"
import { getMailPiece } from "@/lib/mail-catalog/catalog"

import { ProofFrame } from "@/components/campaign-creator/upload/ProofFrame"
import { PostcardPreview } from "@/components/campaign-creator/studio/PostcardPreview"

export function ApprovedProof({
  campaign,
  studioPhotos,
  identity,
}: {
  campaign: Campaign
  studioPhotos: StudioImageState
  identity?: PostcardIdentity
}) {
  const upload = campaign.uploadedDesign
  if (upload?.front && upload.back) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <ProofFrame
          face="front"
          label="Front"
          mediaType={upload.front.mediaType}
          src={`/api/uploaded-design/${campaign.id}/${upload.front.key}`}
        />
        <ProofFrame
          face="back"
          label="Back"
          mediaType={upload.back.mediaType}
          src={`/api/uploaded-design/${campaign.id}/${upload.back.key}`}
        />
      </div>
    )
  }

  const piece = campaign.mailPiece
  const catalog = campaign.mailPieceSpec
  if (!piece || !catalog) {
    return (
      <p className="text-sm text-muted-foreground">
        The approved postcard will show here once the design is ready.
      </p>
    )
  }

  const canvas = toCreativeCanvas(
    getMailPiece(catalog.selectedCatalogId, catalog.selectedCatalogVersion)
  )
  const resolvedIdentity = identity ?? postcardIdentityFromBrief(campaign.brief)
  const photo = presentStudioPhoto(studioPhotos, piece.directionId, piece.spec, campaign.brief)

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Face label="Front">
        <PostcardPreview
          canvas={canvas}
          spec={piece.spec}
          side="front"
          size="hero"
          identity={resolvedIdentity}
          brief={campaign.brief}
          generatedAsset={photo.generatedAsset}
          alternateGeneratedAsset={photo.alternateAsset}
          allowLibraryFallback={photo.allowLibraryFallback}
          enableHoverTilt={false}
          ariaLabel="Front of the postcard"
        />
      </Face>
      <Face label="Back">
        <PostcardPreview
          canvas={canvas}
          spec={piece.spec}
          side="back"
          size="hero"
          identity={resolvedIdentity}
          brief={campaign.brief}
          generatedAsset={photo.generatedAsset}
          alternateGeneratedAsset={photo.alternateAsset}
          allowLibraryFallback={photo.allowLibraryFallback}
          enableHoverTilt={false}
          ariaLabel="Back of the postcard"
        />
      </Face>
    </div>
  )
}

function Face({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium">{label}</figcaption>
      {children}
    </figure>
  )
}
