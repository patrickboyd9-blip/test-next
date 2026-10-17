import type { PostcardFacePlan } from "@/lib/postcard-layouts/compose"

/**
 * A thumbnail frame with nothing in it reads as an empty box.
 * Keep the row when a real photograph can fill it. Otherwise leave it out.
 */
export function planWithRealThumbnails(plan: PostcardFacePlan, fill: string | null): PostcardFacePlan {
  if (fill) return plan
  return {
    ...plan,
    photos: plan.photos.filter((slot) => slot.treatment !== "thumbnail"),
    shapes: plan.shapes.filter((shape) => shape.role !== "thumbnail"),
  }
}
