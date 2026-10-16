import type { CampaignBrief, CreativeDirection, CreativeSpec, LayoutHints } from "@/lib/campaign-creator/types"
import { referenceVerticalsForBrief } from "@/lib/reference-corpus/select-reference-cards"

import { isPostcardTemplate, type PostcardTemplateId, type VerticalPaletteId } from "./ids"
import { templatesForPalette } from "./templates"

/**
 * Copy can pull a roofing composition forward. The cue has to name the idea.
 * "Local" alone is too common to steal a direction.
 */
const TEMPLATE_CUES: Partial<Record<PostcardTemplateId, RegExp>> = {
  storm_alert: /\bstorms?\b|\bhail\b|\bwind damage\b/i,
  financing_first: /\bfinanc|\bmonthly\b|\bper month\b|\/mo\b|\ba month\b|\$\s?\d/i,
  before_after: /\bbefore\b|\bafter\b/i,
  commercial_restore: /\bcommercial\b|\brestoration\b|\bflat roof\b|\bmembrane\b/i,
  local_pride: /\bhometown\b|\bour town\b|\blocal pride\b|\bneighbor(?:hood)?\b/i,
}

/**
 * Each vertical keeps the compositions that fit it.
 * Medicare and other insurance stay on the calm set: no perforated offer,
 * no seal, and no alarm color. Three directions receive three different compositions.
 */
export function verticalPaletteForBrief(brief: CampaignBrief): VerticalPaletteId {
  const verticals = referenceVerticalsForBrief(brief)
  if (
    verticals.some(
      (vertical) =>
        vertical.startsWith("medicare") ||
        vertical.includes("insurance") ||
        vertical === "final_expense"
    )
  ) {
    return "medicare"
  }
  if (verticals.includes("roofing")) return "roofing"
  if (verticals.includes("plumbing")) return "plumbing"
  if (verticals.includes("hvac")) return "hvac"
  const text = [brief.goal, brief.audience?.description, brief.offer, brief.businessInfo?.name]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
  if (/\breal estate\b|\brealtor\b|\blisting\b|\bhome for sale\b|\bsell(?:ing)? (?:a |the |your )?house\b/i.test(text)) {
    return "real_estate"
  }
  return "general"
}

export function assignTemplates<T extends CreativeDirection>(
  brief: CampaignBrief,
  directions: T[]
): T[] {
  const palette = verticalPaletteForBrief(brief)
  const allowed = templatesForPalette(palette)
  const used = new Set<PostcardTemplateId>()
  const ranked = directions
    .map((direction, index) => ({ direction, index }))
    .sort((a, b) => Number(b.direction.recommended) - Number(a.direction.recommended))
  const chosen = new Map<number, PostcardTemplateId>()

  for (const item of ranked) {
    const current = item.direction.spec.layoutHints?.templateId
    if (current && allowed.includes(current) && !used.has(current)) {
      used.add(current)
      chosen.set(item.index, current)
      continue
    }
    const cued = cuedTemplate(item.direction, allowed, used)
    if (cued) {
      used.add(cued)
      chosen.set(item.index, cued)
      continue
    }
    const next = allowed.find((template) => !used.has(template)) ?? allowed[0]
    used.add(next)
    chosen.set(item.index, next)
  }

  return directions.map((direction, index) => {
    const templateId = chosen.get(index) ?? allowed[0]
    return {
      ...direction,
      spec: withTemplate(direction.spec, templateId, palette),
    }
  })
}

export function assignTemplateToSpec(brief: CampaignBrief, spec: CreativeSpec): CreativeSpec {
  const palette = verticalPaletteForBrief(brief)
  const allowed = templatesForPalette(palette)
  const current = spec.layoutHints?.templateId
  const templateId = current && allowed.includes(current) ? current : allowed[0]
  return withTemplate(spec, templateId, palette)
}

function cuedTemplate(
  direction: CreativeDirection,
  allowed: readonly PostcardTemplateId[],
  used: Set<PostcardTemplateId>
): PostcardTemplateId | undefined {
  const blob = [direction.name, direction.spec.headline, direction.spec.subheadline, direction.spec.offer, direction.spec.body]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
  return allowed.find((id) => !used.has(id) && TEMPLATE_CUES[id]?.test(blob))
}

function withTemplate(
  spec: CreativeSpec,
  templateId: PostcardTemplateId,
  palette: VerticalPaletteId
): CreativeSpec {
  const hints: LayoutHints = {
    ...spec.layoutHints,
    templateId,
    verticalPalette: palette,
  }
  return { ...spec, layoutHints: hints }
}

export function templateOnSpec(spec: CreativeSpec): PostcardTemplateId | undefined {
  const value = spec.layoutHints?.templateId
  return isPostcardTemplate(value) ? value : undefined
}
