/**
 * Paint order shared by Studio and the contrast sampler.
 * Paper and a legacy field sit behind the photograph.
 * A type panel sits in front of the photograph so type never rests on the picture.
 */

export function studioShapeLayer(role: string): "back" | "mid" | "front" {
  if (role === "paper" || role === "field") return "back"
  if (role === "scrim" || role === "band") return "mid"
  if (role === "type-panel") return "front"
  return "front"
}
