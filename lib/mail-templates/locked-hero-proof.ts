import { HERO_DESIGNING, HERO_NEED_NOTE, HERO_PROOF_READY } from "@/lib/image-edit/messages"

/** Where the gallery design flow is. The form fields live beside this. */
export type LockedHeroPhase = "form" | "designing" | "proof" | "error"

export interface LockedHeroProofState {
  phase: LockedHeroPhase
  message: string
  frontSrc: string | null
  backSrc: string | null
  /** Unpaid proofs show the light PROOF mark. */
  proof: boolean
  /**
   * The picture the next edit starts from.
   * Null means the locked gallery picture. A proof front means "change this one".
   */
  editSource: string | null
}

export const LOCKED_HERO_PROOF_START: LockedHeroProofState = {
  phase: "form",
  message: "",
  frontSrc: null,
  backSrc: null,
  proof: false,
  editSource: null,
}

export function beginLockedHeroEdit(missing: string | null): { run: boolean; state: LockedHeroProofState } {
  if (missing) {
    return { run: false, state: { ...LOCKED_HERO_PROOF_START, message: missing } }
  }
  return { run: true, state: markLockedHeroDesigning(LOCKED_HERO_PROOF_START, null) }
}

export function markLockedHeroDesigning(state: LockedHeroProofState, source: string | null): LockedHeroProofState {
  return { ...state, phase: "designing", message: HERO_DESIGNING, editSource: source }
}

export function finishLockedHeroEdit(
  previous: LockedHeroProofState,
  result:
    | { ok: true; frontSrc: string; backSrc: string; proof: boolean }
    | { ok: false; message: string }
): LockedHeroProofState {
  if (!result.ok) {
    return { ...previous, phase: "error", message: result.message }
  }
  return {
    phase: "proof",
    message: HERO_PROOF_READY,
    frontSrc: result.frontSrc,
    backSrc: result.backSrc,
    proof: result.proof,
    editSource: result.frontSrc,
  }
}

/** Ask for another edit of the proof on screen. A blank note stays on the proof. */
export function requestLockedHeroChanges(
  state: LockedHeroProofState,
  note: string
): { run: boolean; state: LockedHeroProofState; note: string } {
  const clean = note.replace(/\s+/g, " ").trim()
  if (state.phase !== "proof" || !state.frontSrc) {
    return { run: false, note: clean, state }
  }
  if (clean.length < 2) {
    return { run: false, note: clean, state: { ...state, message: HERO_NEED_NOTE } }
  }
  return { run: true, note: clean, state: markLockedHeroDesigning(state, state.frontSrc) }
}

/** Back to the form. Callers keep the typed fields. */
export function restartLockedHeroForm(): LockedHeroProofState {
  return { ...LOCKED_HERO_PROOF_START }
}
