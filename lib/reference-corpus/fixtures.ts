import type { ReferenceCorpusItem } from "./types"

/**
 * Application-side intake pointer to MMR-001 in modern-mail-research.
 * Does not copy the example markdown, principles, or syntheses.
 */
export const MMR_001_INTAKE_ID = "ref-mmr-001"

export const MMR_001_INTAKE: ReferenceCorpusItem = {
  id: MMR_001_INTAKE_ID,
  sourceClass: "grok_research",
  label: "MMR-001 — Roofing postcard using visual urgency and free value-add",
  addedAt: "2026-09-16T00:00:00.000Z",
  media: {},
  provenance: {
    acquiredBy: "modern-mail-research",
    researchId: "MMR-001",
    recordPath: "examples/2026-09-16-MMR-001.md",
    locator:
      "https://github.com/patrickboyd9-blip/modern-mail-research/blob/main/examples/2026-09-16-MMR-001.md",
    note: "Intake pointer to the existing modern-mail-research record. Not a copy of the example, principles, or syntheses. INTERNAL RESEARCH / REFERENCE ONLY.",
  },
}
