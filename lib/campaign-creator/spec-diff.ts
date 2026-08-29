import type { CreativeSpec, SpecDiff, SpecDiffChange } from "./types"

export function cloneSpec(spec: CreativeSpec): CreativeSpec {
  return JSON.parse(JSON.stringify(spec)) as CreativeSpec
}

const SPEC_FIELD_LABELS: Record<string, string> = {
  headline: "Headline",
  subheadline: "Subheadline",
  body: "Body",
  callToAction: "Call to action",
  offer: "Offer",
  phone: "Phone number",
  website: "Website",
  palette: "Colors",
  tone: "Tone",
  layoutHints: "Layout",
}

export function buildSpecDiff(before: CreativeSpec, after: CreativeSpec): SpecDiff {
  const changedRegions: string[] = []
  const changes: SpecDiffChange[] = []

  const keys = [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ] as Array<keyof CreativeSpec>

  for (const key of keys) {
    const beforeVal = serializeSpecField(key, before[key])
    const afterVal = serializeSpecField(key, after[key])
    if (beforeVal === afterVal) continue

    if (key === "palette") changedRegions.push("palette")
    else if (key === "layoutHints") changedRegions.push("layoutHints")
    else if (key === "phone") changedRegions.push("phone")
    else if (key === "callToAction") changedRegions.push("callToAction")
    else if (key === "headline" || key === "subheadline") changedRegions.push("headline")
    else if (key === "body") changedRegions.push("body")
    else if (key === "offer") changedRegions.push("offer")
    else changedRegions.push(String(key))
  }

  for (const key of keys) {
    const beforeVal = serializeSpecField(key, before[key])
    const afterVal = serializeSpecField(key, after[key])
    if (beforeVal === afterVal) continue
    changes.push({
      field: String(key),
      before: beforeVal,
      after: afterVal,
      label: SPEC_FIELD_LABELS[String(key)] ?? String(key),
    })
  }

  return {
    changedRegions: [...new Set(changedRegions)],
    changes,
  }
}

function serializeSpecField(key: keyof CreativeSpec, value: unknown): string {
  if (value === undefined) return ""
  if (key === "palette" && Array.isArray(value)) return value.join(", ")
  if (key === "layoutHints" && typeof value === "object") return JSON.stringify(value)
  return String(value)
}

export function buildSuccessStudioResponse(
  specDiff: SpecDiff,
  preservationNote?: string
): string {
  if (specDiff.changes.length === 0) {
    return "Done — your design is updated."
  }

  const changeDescriptions = specDiff.changes.map((change) => {
    switch (change.field) {
      case "headline":
        return change.after.toLowerCase().includes("scale")
          ? "headline is larger"
          : `headline updated`
      case "palette":
        return "colors are warmer"
      case "layoutHints":
        if (change.after.includes("bottom-right")) return "phone number is now bottom-right"
        if (change.after.includes("large")) return "QR code is more prominent"
        return "layout adjusted"
      case "phone":
        return "phone number updated"
      default:
        return `${change.label.toLowerCase()} updated`
    }
  })

  const unique = [...new Set(changeDescriptions)]
  const changeList =
    unique.length === 1
      ? unique[0]
      : unique.slice(0, -1).join(", ") + " and " + unique[unique.length - 1]

  let response = `Done — ${changeList}.`
  if (preservationNote) response += ` ${preservationNote}`
  return response
}

export function buildPreservationNote(preserved: string[]): string | undefined {
  if (preserved.length === 0) return undefined
  if (preserved.length === 1) return `Your ${preserved[0]} is unchanged.`
  return `Your ${preserved.slice(0, -1).join(", ")} and ${preserved[preserved.length - 1]} are unchanged.`
}
