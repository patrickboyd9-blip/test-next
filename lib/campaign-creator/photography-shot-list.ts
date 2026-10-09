import type { ImageBrief, ImageBriefRole } from "./image-brief"

/**
 * Photographer's shot list sent as the Images API prompt.
 * The campaign look block is copied word for word so three directions
 * share one light, grade, region, and wardrobe.
 */
export const OPENAI_IMAGE_ALWAYS_EXCLUSIONS =
  "No text, letters, signage, logos, watermarks, QR codes, or overlays. Plain unbranded uniforms and vehicles. A single photograph, not an ad layout. Avoid plastic skin, CGI gloss, symmetrical faces, and warped tools or ladders."

const ROLE_SHOT: Record<ImageBriefRole, string> = {
  consequence:
    "Show the cost of waiting as one calm, specific situation. Not gore and not a spectacle.",
  crew: "Show the work itself. Not a posed greeting and not a named crew.",
  neighborhood:
    "Show the ordinary place. Not one address treated as the recipient's home.",
}

export function buildOpenAIImagePrompt(brief: ImageBrief): string {
  const art = brief.artDirection
  const tone = brief.tone?.trim()
  const invented = brief.doNotInvent
    .map((item) => `Do not invent ${item}.`)
    .join(" ")

  return [
    `Shot: One documentary photograph, taken mid-task. Nobody is looking at the camera. If a person is in frame, they are an ordinary adult about 30 to 55, with natural skin. ${ROLE_SHOT[brief.imageryRole]}`,
    [
      `Subject and action: ${art.subject}`,
      art.craft ? `Craft to imitate, not a picture to copy: ${art.craft}` : null,
      "Hands that appear have a clear job with a tool or material. Do not pose empty hands toward the camera. Trade-specific details stay visible.",
    ]
      .filter((line): line is string => Boolean(line))
      .join(" "),
    [
      "Setting and region: Lived-in local homes and ordinary work places.",
      ROLE_SHOT[brief.imageryRole],
      "This is communication, not evidence. It is not documentation of this recipient's home, property, actual crew, or damage.",
      tone ? `Tone of the situation: ${tone}.` : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join(" "),
    `Light: ${brief.lookBlock}`,
    `Camera and lens: ${cameraLine(brief)}`,
    "Imperfections: Ordinary wear only: a wrinkle, a scuff, dust in the light, uneven paint or a tired edge. Skin is not retouched. The place looks used.",
    `Negative space: ${art.negativeSpace}`,
    [
      "Exclusions:",
      invented,
      "Do not invent campaign-specific proof. When NOT: cheap fear or gore escalation.",
      art.refuse,
      OPENAI_IMAGE_ALWAYS_EXCLUSIONS,
    ].join(" "),
  ].join("\n")
}

function cameraLine(brief: ImageBrief): string {
  const grade = "Fine grain, true-to-life color, no HDR."
  if (brief.imageryRole === "neighborhood") {
    return `Full-frame, 24mm, eye level, verticals corrected. ${grade}`
  }
  if (brief.imageryRole === "crew") {
    return `Full-frame, 50mm, eye level. ${grade}`
  }
  return `Full-frame, 35mm at f/4, eye level. ${grade}`
}
