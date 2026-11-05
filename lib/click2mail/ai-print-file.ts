import { postcardImageFromDataUrl, resolveAddressSideSections } from "@/lib/campaign-creator/address-side"
import { withRequiredDisclosures } from "@/lib/research-library/auto-disclosures"
import { attorneyAdMark } from "@/lib/design-intelligence/attorney-compliance"
import { medicareDisclaimerFor } from "@/lib/campaign-creator/medicare-compliance"
import { displayWebsite, postcardIdentityFromBrief, resolveStudioContact } from "@/lib/campaign-creator/studio-contact"
import type { Campaign, CreativeSpec } from "@/lib/campaign-creator/types"
import type { PostcardPrintCopy, PostcardPrintImage } from "@/lib/print-spec/render-campaign-postcard-pdf"
import { renderPostcardPrintPdf } from "@/lib/print-spec/render-campaign-postcard-pdf"
import { renderStudioDesignPdf, renderTemplatedPostcardPdf, selectPrintDesign } from "@/lib/print-spec/render-template-postcard-pdf"
import { composeRoofingProCard } from "@/lib/roofing-pro/compose"
import { isRoofingProTemplate } from "@/lib/roofing-pro/ids"
import { composeGridCard } from "@/lib/design-intelligence/grid-composer"
import { isDesignRationale } from "@/lib/design-intelligence/rationale"
import { isPostcardTemplate, isVerticalPalette } from "@/lib/postcard-layouts/ids"

import { isSoftFadeBack } from "@/lib/campaign-creator/address-side-layout"
import { loadFinalPostcardPhoto } from "./load-print-photo"

/**
 * The print file for an AI-designed postcard: page 1 is the front, page 2 the back.
 * Click2Mail gets these exact bytes, and the approved-concept proof shows them.
 */
export async function renderAiPrintFile(campaign: Campaign): Promise<{
  bytes: Uint8Array
  artwork: "final-photo" | "type-plate"
  size: "5x8" | "6x9"
}> {
  const photo = await loadFinalPostcardPhoto(campaign)
  const templateId = campaign.mailPiece?.spec.layoutHints?.templateId
  const paletteId = campaign.mailPiece?.spec.layoutHints?.verticalPalette
  const copy = printCopy(campaign)
  const backImage = backPrintImage(campaign.mailPiece?.spec, photo)
  const rationale = campaign.mailPiece?.spec.designRationale
  const size = rationale?.format?.trim === "6x9" ? "6x9" : "5x8"
  const returnAddress = (copy.returnLines ?? []).join("\n")
  const studio = isRoofingProTemplate(templateId)
    ? composeRoofingProCard({
        templateId,
        size,
        spec: campaign.mailPiece?.spec ?? {},
        businessName: copy.businessName,
        qrPayload: copy.qrPayload,
        license: copy.license,
        returnAddress,
        disclaimerText: copy.disclaimer,
        complianceMark: copy.complianceMark,
        trade: campaign.mailPiece?.spec.layoutHints?.trade,
      })
    : isDesignRationale(rationale)
    ? composeGridCard({
        rationale,
        spec: campaign.mailPiece?.spec ?? {},
        businessName: copy.businessName,
        disclaimer: copy.disclaimer,
        complianceMark: copy.complianceMark,
        license: copy.license,
        returnAddress,
      })
    : null
  const design = selectPrintDesign({ rationale, studio, templateId })
  const backPhoto = backImage ?? (design.source === "studio" && isSoftFadeBack(design.card.back) ? photo ?? undefined : undefined)
  const rendered = design.source === "studio"
    ? await renderStudioDesignPdf({
        card: design.card,
        copy,
        image: photo ?? undefined,
        backImage: backPhoto,
      })
    : isPostcardTemplate(templateId)
    ? await renderTemplatedPostcardPdf({
        copy,
        templateId,
        paletteId: isVerticalPalette(paletteId) ? paletteId : undefined,
        image: photo ?? undefined,
        backImage,
      })
    : await renderPostcardPrintPdf({
        copy,
        image: photo ?? undefined,
        backImage,
        plateColor: plateFromSpec(campaign.mailPiece?.spec),
      })

  return { bytes: rendered.bytes, artwork: rendered.artwork, size }
}

function printCopy(campaign: Campaign): PostcardPrintCopy {
  const spec = campaign.mailPiece?.spec ?? {}
  const identity = postcardIdentityFromBrief(campaign.brief)
  const contact = resolveStudioContact(spec, identity)
  const address = campaign.brief.businessInfo?.address?.trim()
  const legal = withRequiredDisclosures({
    brief: campaign.brief,
    printedText: [spec.headline, spec.subheadline, spec.body, spec.offer, spec.callToAction, contact.businessName].filter(Boolean).join(" "),
    disclaimer: medicareDisclaimerFor(campaign.brief),
    complianceMark: attorneyAdMark([
      campaign.brief.goal,
      campaign.brief.offer,
      campaign.brief.audience?.description,
      campaign.brief.businessInfo?.name,
      spec.headline,
      spec.body,
      spec.offer,
    ].filter(Boolean).join(" ")),
  })
  return {
    headline: spec.headline,
    body: spec.body,
    offer: spec.offer,
    callToAction: spec.callToAction,
    businessName: contact.businessName,
    phone: contact.phone,
    website: contact.website ? displayWebsite(contact.website) : undefined,
    qrPayload: contact.qrPayload ?? undefined,
    returnLines: addressReturnLines(spec, address),
    subheadline: spec.subheadline,
    disclaimer: legal.disclaimer,
    license: spec.addressSide?.license || campaign.brief.businessInfo?.license,
    addressSide: spec.addressSide,
    complianceMark: legal.complianceMark,
  }
}

function addressReturnLines(spec: CreativeSpec, briefAddress: string | undefined): string[] {
  if (!spec.addressSide) return briefAddress ? [briefAddress] : []
  const sections = resolveAddressSideSections(spec.addressSide)
  if (!sections.returnAddress) return []
  const text = (spec.addressSide.returnAddress ?? briefAddress ?? "").trim()
  return text.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 3)
}

function backPrintImage(
  spec: CreativeSpec | undefined,
  front: PostcardPrintImage | null
): PostcardPrintImage | undefined {
  const edit = spec?.addressSide
  if (!edit || !resolveAddressSideSections(edit).photo) return undefined
  if (edit.photoSrc === "none") return undefined
  if (typeof edit.photoSrc === "string") return postcardImageFromDataUrl(edit.photoSrc) ?? undefined
  return front ?? undefined
}

function plateFromSpec(spec: CreativeSpec | undefined): [number, number, number] | undefined {
  const match = spec?.palette?.[0]?.trim().match(/^#([0-9a-fA-F]{6})$/)
  if (!match) return undefined
  const hex = match[1] ?? ""
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ]
}
