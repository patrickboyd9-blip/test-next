/**
 * Paint order shared by Studio and the contrast sampler.
 * Paper, a legacy field, and thumbnail frames sit behind the photograph
 * so a frame only shows as a border. A type panel sits in front.
 */

export function studioShapeLayer(role: string): "back" | "mid" | "front" {
  if (role === "paper" || role === "field" || role === "thumbnail") return "back"
  if (role === "scrim" || role === "band") return "mid"
  if (role === "type-panel") return "front"
  return "front"
}
