import { templateUsesSoftFadeBack } from "@/lib/roofing-pro/compose"
import { isRoofingProTemplate } from "@/lib/roofing-pro/ids"
import { composeGridCard } from "@/lib/design-intelligence/grid-composer"
import { isDesignRationale } from "@/lib/design-intelligence/rationale"
import { isSoftFadeBack } from "@/lib/campaign-creator/address-side-layout"
import type { AddressSideSections, CreativeSpec } from "@/lib/campaign-creator/types"

/** True when this spec's back renders as the soft-fade back (it follows a fade front). */
export function specUsesSoftFadeBack(spec: CreativeSpec): boolean {
  const templateId = spec.layoutHints?.templateId
  if (isRoofingProTemplate(templateId)) return templateUsesSoftFadeBack(templateId)
  if (!isDesignRationale(spec.designRationale)) return false
  try {
    return isSoftFadeBack(composeGridCard({ rationale: spec.designRationale, spec }).back)
  } catch {
    return false
  }
}

/** Section toggles as the back actually shows them before the customer edits anything. */
export function defaultBackSections(softFade: boolean): AddressSideSections {
  return {
    offer: softFade,
    benefits: false,
    proof: true,
    license: softFade,
    contact: true,
    returnAddress: false,
    qr: false,
    photo: softFade,
  }
}
