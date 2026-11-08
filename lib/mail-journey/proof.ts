import { createHash } from "node:crypto"

import type { MailPiece, UploadedDesign } from "@/lib/campaign-creator/types"

export interface ProofFace {
  role: "front" | "back"
  source: "upload" | "mail-piece"
  key: string
  byteLength: number | null
  version: number | null
}

export interface FrozenProof {
  front: ProofFace
  back: ProofFace
  proofHash: string
}

export type ProofFreeze = { ok: true; proof: FrozenProof } | { ok: false; message: string }

function hashProof(front: ProofFace, back: ProofFace): string {
  return createHash("sha256")
    .update(JSON.stringify({ front, back }))
    .digest("hex")
}

/**
 * Both faces must already exist. A studio mail piece is one approved version
 * covering both faces. An upload uses each file's own key and byte length.
 */
export function freezeProof(input: {
  mailPiece?: MailPiece | null
  uploadedDesign?: UploadedDesign | null
}): ProofFreeze {
  const upload = input.uploadedDesign
  if (upload?.front && upload.back) {
    const front: ProofFace = {
      role: "front",
      source: "upload",
      key: upload.front.preparedKey || upload.front.key,
      byteLength: upload.front.byteLength,
      version: null,
    }
    const back: ProofFace = {
      role: "back",
      source: "upload",
      key: upload.back.preparedKey || upload.back.key,
      byteLength: upload.back.byteLength,
      version: null,
    }
    return { ok: true, proof: { front, back, proofHash: hashProof(front, back) } }
  }
  const piece = input.mailPiece
  if (piece) {
    const front: ProofFace = {
      role: "front",
      source: "mail-piece",
      key: piece.id,
      byteLength: null,
      version: piece.version,
    }
    const back: ProofFace = {
      role: "back",
      source: "mail-piece",
      key: piece.id,
      byteLength: null,
      version: piece.version,
    }
    return { ok: true, proof: { front, back, proofHash: hashProof(front, back) } }
  }
  return {
    ok: false,
    message: "No two-sided proof is frozen yet. Approve a front and a back before checkout.",
  }
}
