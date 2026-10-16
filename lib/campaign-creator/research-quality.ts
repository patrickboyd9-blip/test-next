import { resolvePostcardLayout } from "@/components/campaign-creator/studio/postcard-layout-qa"
import type { RubricCheck } from "@/components/campaign-creator/studio/postcard-rubric"

import { layoutPolicyForBrief } from "@/lib/reference-corpus/research-layout"
import type {
  CampaignBrief,
  CreativeDirection,
  CreativeSpec,
  ResearchQuality,
} from "./types"

/** A direction under this score gets one repair, then it is shown. */
export const RESEARCH_QUALITY_THRESHOLD = 7
export const RESEARCH_QUALITY_MAX_ATTEMPTS = 2

/**
 * Score each direction against the postcard rubric and the research layout.
 * One repair is allowed. The score stays on the direction for storage and is
 * not customer-facing.
 */
export function repairResearchQuality(
  brief: CampaignBrief,
  directions: CreativeDirection[]
): CreativeDirection[] {
  const policy = layoutPolicyForBrief(brief)
  return directions.map((direction) => {
    let spec = direction.spec
    const layoutMatches =
      policy.mode === "open" ||
      (spec.layoutVariant ? policy.allowed.includes(spec.layoutVariant) : false)
    let quality = scoreSpec(spec, layoutMatches)
    if (policy.mode === "research" && quality.score < RESEARCH_QUALITY_THRESHOLD) {
      spec = repairSpec(spec, quality)
      quality = scoreSpec(spec, policy.allowed.includes(spec.layoutVariant ?? "peer_split"))
      quality.attempts = RESEARCH_QUALITY_MAX_ATTEMPTS
      quality.notes = [
        ...quality.notes,
        "One repair was applied. Specimen mailer images were not required for this score.",
      ]
    } else {
      quality.notes = [
        ...quality.notes,
        "Scored from the postcard rubric and the research layout. Specimen images are attached only when they are on disk.",
      ]
    }
    return {
      ...direction,
      spec,
      research: direction.research
        ? { ...direction.research, parameters: parametersFrom(spec, direction), quality }
        : direction.research,
    }
  })
}

function parametersFrom(
  spec: CreativeSpec,
  direction: CreativeDirection
): NonNullable<CreativeDirection["research"]>["parameters"] {
  const current = direction.research?.parameters
  if (!current) {
    return {
      headlineScale: spec.layoutHints?.headlineScale ?? 1,
      headlinePosition: spec.layoutHints?.headlinePosition ?? "beside_photo",
      photoShare: 0.5,
      photoCrop: spec.layoutHints?.photoCrop ?? "open",
      offerBadge: spec.layoutHints?.offerBadge ?? "inline",
      colorBlock: spec.layoutHints?.colorBlock ?? "none",
    }
  }
  return {
    ...current,
    headlineScale: spec.layoutHints?.headlineScale ?? current.headlineScale,
    headlinePosition: spec.layoutHints?.headlinePosition ?? current.headlinePosition,
    photoCrop: spec.layoutHints?.photoCrop ?? current.photoCrop,
    offerBadge: spec.layoutHints?.offerBadge ?? current.offerBadge,
    colorBlock: spec.layoutHints?.colorBlock ?? current.colorBlock,
  }
}

function scoreSpec(spec: CreativeSpec, layoutMatches: boolean): ResearchQuality {
  const plan = resolvePostcardLayout({ spec })
  const checks = plan.rubric
  const passed = checks.filter((check) => check.pass)
  const failed = checks.filter((check) => !check.pass)
  const pass = (id: RubricCheck["id"]) => checks.some((check) => check.id === id && check.pass)
  const hierarchy = (pass("AF5") ? 1 : 0) + (pass("AF3") ? 1 : 0)
  const legibility = [pass("AF1"), pass("AF2"), pass("AF6")].filter(Boolean).length
  const offerClarity = spec.offer?.trim() ? (pass("AF5") ? 2 : 1) : pass("AF3") ? 1 : 0
  const photoRelevance = pass("AF4") ? 2 : 0
  const craftResemblance = layoutMatches ? 2 : 0
  const rubricScore = passed.length
  const craftBonus = layoutMatches ? 0 : -1
  return {
    score: Math.max(0, Math.min(10, rubricScore + craftBonus)),
    rubricPassed: rubricScore,
    rubricTotal: checks.length,
    hierarchy,
    legibility,
    offerClarity,
    photoRelevance,
    craftResemblance,
    attempts: 1,
    notes: failed.map((check) => `${check.id}: ${check.detail}`),
  }
}

function repairSpec(spec: CreativeSpec, quality: ResearchQuality): CreativeSpec {
  const next: CreativeSpec = {
    ...spec,
    layoutHints: { ...spec.layoutHints },
  }
  const photoFailed = quality.notes.some((note) => note.startsWith("AF4"))
  if (photoFailed && next.imagePresence === "accent" && next.layoutVariant !== "type_only") {
    delete next.imagePresence
  }
  if (quality.notes.some((note) => note.startsWith("AF7"))) {
    next.layoutHints = { ...next.layoutHints, qrProminence: "large" }
  }
  if (next.offer?.trim() && next.layoutHints?.offerBadge !== "band") {
    next.layoutHints = { ...next.layoutHints, offerBadge: "inline" }
  }
  return next
}
