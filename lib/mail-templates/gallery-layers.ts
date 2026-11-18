import { placeLayer, placementLimits } from "@/lib/image-edit/placement"
import type { ProofLayer } from "@/lib/image-edit/types"

import type { MailTemplate } from "./types"

/** A gallery card as separate layers. The photograph, if any, is not the words. */
export function layersForGallery(template: MailTemplate): ProofLayer[] {
  const limits = placementLimits(template.size, "front")
  const [ground, accent, ink] = template.spec.palette ?? ["#102033", "#c4922a", "#f7f4ee"]
  const placed = (id: string, kind: ProofLayer["kind"], box: { x: number; y: number; w: number; h: number }, extra: Partial<ProofLayer>): ProofLayer => ({
    id,
    face: "front",
    kind,
    z: 0,
    ...placeLayer(box, limits),
    ...extra,
  })
  return [
    placed("ground", "color", { x: limits.safe.x, y: limits.safe.y, w: limits.safe.w, h: limits.safe.h * 0.72 }, { z: 0, color: ground, name: "Background" }),
    placed("accent", "color", { x: limits.safe.x, y: limits.safe.y + limits.safe.h * 0.74, w: limits.safe.w, h: limits.safe.h * 0.24 }, { z: 1, color: accent, name: "Color" }),
    placed("headline", "text", { x: limits.safe.x + 3, y: limits.safe.y + 4, w: limits.safe.w - 6, h: 16 }, { z: 2, text: template.spec.headline, color: ink, name: "Headline" }),
    placed("offer", "text", { x: limits.safe.x + 3, y: limits.safe.y + 22, w: limits.safe.w - 6, h: 12 }, { z: 3, text: template.spec.offer, color: ink, name: "Offer" }),
    placed("cta", "text", { x: limits.safe.x + 3, y: limits.safe.y + limits.safe.h * 0.76, w: limits.safe.w - 6, h: 10 }, { z: 4, text: template.spec.callToAction, color: "#102033", name: "Response" }),
  ]
}
