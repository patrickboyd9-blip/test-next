/**
 * Creative Studio timing — switch fast dev iteration vs PRD production pacing
 * via NEXT_PUBLIC_STUDIO_FAST_GENERATION=true or NODE_ENV=development.
 */
const useFastGeneration =
  process.env.NEXT_PUBLIC_STUDIO_FAST_GENERATION === "true" ||
  process.env.NODE_ENV === "development"

export const STUDIO_GENERATION = {
  /** Total simulated generation before lead reveal. PRD: ~6–8s production. */
  totalDurationMs: useFastGeneration ? 1000 : 7000,
  /** Interval between narrative line crossfades. PRD: 2.5s production. */
  narrativeIntervalMs: useFastGeneration ? 250 : 2500,
  /** When to show slow-state copy (unused in 2A shell — reserved for 2B). */
  slowThresholdMs: useFastGeneration ? 800 : 15000,
} as const
