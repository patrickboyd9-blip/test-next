import type { PostcardFacePlan } from "@/lib/postcard-layouts/compose"
import type { LayoutSizeId } from "@/lib/postcard-layouts/ids"

/**
 * A thumbnail frame with nothing in it reads as an empty box.
 * Keep the row when a real photograph can fill it. Otherwise leave it out.
 */
export function planWithRealThumbnails<S extends LayoutSizeId>(
  plan: PostcardFacePlan<S>,
  fill: string | null
): PostcardFacePlan<S> {
  if (fill) return plan
  return {
    ...plan,
    photos: plan.photos.filter((slot) => slot.treatment !== "thumbnail"),
    shapes: plan.shapes.filter((shape) => shape.role !== "thumbnail"),
  }
}
