/**
 * Roofing headlines that name damage need a photograph that shows it.
 * "Curling shingles get worse fast" over a spotless new roof reads as a lie,
 * and a storm headline over an untouched house reads as a stock photo.
 *
 * The scene is illustrative category damage (any house), never a claim about
 * the recipient's roof, and a roofer is shown fixing it in bright daylight.
 */

export type RoofDamageKind =
  | "curling"
  | "missing"
  | "hail"
  | "storm"
  | "moss"
  | "leak"
  | "ice_dam"
  | "granules"
  | "cracked_tile"
  | "sagging"
  | "aging"

interface DamageRule {
  kind: RoofDamageKind
  /** Headline or angle wording that names this damage. */
  cue: RegExp
  /** What the photograph must show, close enough to read on a postcard. */
  scene: string
  /** Words the final image prompt must carry so the model draws it. */
  proof: RegExp
}

const ROOFER =
  "One roofer in a work shirt and safety harness kneels on the roof working on that section, face visible and not cropped."

const RULES: readonly DamageRule[] = [
  {
    kind: "curling",
    cue: /\bcurl(?:ing|ed|s)?\b|\bcupp(?:ing|ed)\b/i,
    scene: "A clearly aged asphalt shingle roof on a suburban house where many shingles are visibly curling and cupping upward at the edges, the curled tabs easy to see from the street in the lower part of the roof.",
    proof: /\bcurl/i,
  },
  {
    kind: "missing",
    cue: /\bmissing shingles?\b|\bshingles? (?:missing|blown off|gone)\b|\blifted shingles?\b|\bblown[- ]off\b/i,
    scene: "A suburban house roof with several shingles clearly missing, dark patches of exposed underlayment and a few lifted tabs visible on the front slope.",
    proof: /\bmissing shingles?|exposed underlayment/i,
  },
  {
    kind: "hail",
    cue: /\bhail\b/i,
    scene: "A suburban asphalt shingle roof with visible hail damage: scattered dark bruise marks and dented spots across the shingles, a dented gutter, small hail stones melting on the lawn.",
    proof: /\bhail damage|dent/i,
  },
  {
    kind: "storm",
    cue: /\bstorms?\b|\bwind(?:storm)? damage\b|\bhigh winds?\b|\bhurricane\b|\btornado\b|\bafter the storm\b/i,
    scene: "A suburban house the morning after a storm: a few shingles torn off the front slope with exposed underlayment, small branches and leaves on the roof and lawn, a blue tarp folded at the ridge.",
    proof: /\btorn off|storm|exposed underlayment/i,
  },
  {
    kind: "moss",
    cue: /\bmoss\b|\balgae\b|\blichen\b|\bblack streaks?\b/i,
    scene: "A house roof with thick green moss growing between the shingles and dark algae streaks running down one slope, clearly visible from the street.",
    proof: /\bmoss|algae/i,
  },
  {
    kind: "leak",
    cue: /\bleak(?:s|ing|y)?\b|\bwater (?:spots?|stains?|damage)\b|\bdrip(?:s|ping)?\b/i,
    scene: "A house roof with a visibly damaged section near a vent and chimney flashing: cracked and lifted shingles and failed flashing, exposed wet underlayment where water gets in.",
    proof: /\bflashing|lifted shingles|exposed .*underlayment/i,
  },
  {
    kind: "ice_dam",
    cue: /\bice dams?\b|\bicicles?\b/i,
    scene: "A winter house roof with a thick ridge of ice built up along the eaves, long icicles hanging from the gutters, melting snow on the upper roof, bright winter sun.",
    proof: /\bice\b|icicle/i,
  },
  {
    kind: "granules",
    cue: /\bgranules?\b|\bbald(?:ing)? shingles?\b|\bworn[- ]out shingles?\b/i,
    scene: "A close view of a worn asphalt shingle roof with bald patches where the granules have washed off, granules collected in the gutter.",
    proof: /\bgranule/i,
  },
  {
    kind: "cracked_tile",
    cue: /\bcracked tiles?\b|\bbroken tiles?\b|\btile (?:roof )?(?:damage|cracks?)\b|\bslipped tiles?\b|\bunderlayment\b/i,
    scene: "A clay tile roof on a stucco house with several visibly cracked and slipped tiles, a gap showing worn underlayment beneath.",
    proof: /\bcracked .*tiles?|slipped tiles?/i,
  },
  {
    kind: "sagging",
    cue: /\bsag(?:ging|s)?\b|\bsoft spots?\b|\brott(?:ing|en)\b/i,
    scene: "An older house roof with a visibly sagging, uneven section of the roofline and worn shingles, clearly out of line with the rest of the roof.",
    proof: /\bsag/i,
  },
  {
    kind: "aging",
    cue: /\b(?:old|aging|aged|worn|tired|failing|\d{2}\+?[- ]year[- ]old) (?:roof|shingles?)\b|\broofs? (?:past|over) \d+\b|\bdamage(?:d)?\b/i,
    scene: "An aging asphalt shingle roof on a suburban house showing clear wear: faded uneven color, a few curled and cracked shingles, and a patched section on the front slope.",
    proof: /\bcurled|cracked shingles|worn|faded/i,
  },
]

/** Damage the headline (or angle) names, or null when it names none. */
export function roofDamageInHeadline(...texts: Array<string | undefined | null>): RoofDamageKind | null {
  const text = texts.filter((value): value is string => Boolean(value?.trim())).join(" ")
  if (!text) return null
  // "No damage", "before damage starts" and "damage-free" do not name damage to show.
  const cleaned = text.replace(/\b(?:no|without|before (?:the )?|prevent(?:ing)?|damage[- ]free)\s*damage\b/gi, " ")
  for (const rule of RULES) if (rule.cue.test(cleaned)) return rule.kind
  return null
}

/** The photograph subject for a damage headline: the damage, plus a roofer fixing it. */
export function roofDamageScene(kind: RoofDamageKind): string {
  const rule = RULES.find((item) => item.kind === kind)!
  return `${rule.scene} ${ROOFER} Low camera from the lawn looking up at the front slope: the damaged section and the roofer sit in the upper half of the frame, between 10% and 45% from the top, large and sharp. The lower half of the frame is the house wall, windows, and lawn, with no damage there, because postcard text covers it. Illustrative example of this kind of damage, not a specific customer's house.`
}

export const ROOF_DAMAGE_REFUSE =
  "Do not show a spotless brand-new roof; the damage named above must be clearly visible. No collapsed house, no disaster ruin, no flooding, no fire."

/**
 * Check: does the image prompt actually ask for the damage the headline names?
 * Returns a short problem string, or null when the prompt matches.
 */
export function roofDamagePhotoMismatch(headline: string | undefined, photoPrompt: string): string | null {
  const kind = roofDamageInHeadline(headline)
  if (!kind) return null
  const rule = RULES.find((item) => item.kind === kind)!
  if (!rule.proof.test(photoPrompt)) return `headline names ${kind.replace("_", " ")} damage but the photo prompt does not show it`
  if (/\b(?:freshly installed|brand[- ]new roof|crisp new shingle|new roof clean and even)\b/i.test(photoPrompt)) {
    return `headline names ${kind.replace("_", " ")} damage but the photo prompt asks for a new, undamaged roof`
  }
  return null
}
