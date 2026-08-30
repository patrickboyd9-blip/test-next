/**
 * Creative Studio timing. Narrative cadence can run faster in development.
 * Slow / fail thresholds stay at PRD values so recovery copy is testable
 * against a real provider, not a fake wait.
 */
const useFastNarrative =
  process.env.NEXT_PUBLIC_STUDIO_FAST_GENERATION === "true" ||
  process.env.NODE_ENV === "development"

export const STUDIO_GENERATION = {
  /** Interval between narrative line crossfades. PRD: 2.5s production. */
  narrativeIntervalMs: useFastNarrative ? 250 : 2500,
  /** PRD: slow narration at 15s. */
  slowThresholdMs: 15_000,
  /** PRD: second slow line at 30s. */
  secondSlowThresholdMs: 30_000,
  /** PRD: fail the generation wait at 45s. */
  failThresholdMs: 45_000,
} as const

export const STUDIO_REFINEMENT = {
  /** PRD: keep “Applying your change…” visible through 8s. */
  applyingThresholdMs: 8_000,
  /** PRD: inline slow-network copy at 20s; spec unchanged; customer may retry. */
  slowNetworkMs: 20_000,
} as const
