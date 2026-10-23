import type { Recipient } from "@/lib/click2mail/recipients"

import { sha256Hex, stableStringify } from "./hash"

export interface DesignFingerprintSource {
  mailPiece?: { id: string; version: number; spec: unknown } | null
  uploadedDesign?: {
    front?: { key: string; byteLength: number } | null
    back?: { key: string; byteLength: number } | null
    checkedAt?: string
    approvedAt?: string
    printFileKey?: string
  } | null
}

/** Changes when the approved design changes. Does not include the mailing list. */
export function designFingerprint(source: DesignFingerprintSource): string {
  const upload = source.uploadedDesign
  return sha256Hex(
    stableStringify({
      mailPieceId: source.mailPiece?.id ?? null,
      mailPieceVersion: source.mailPiece?.version ?? null,
      spec: source.mailPiece?.spec ?? null,
      uploadFront: upload?.front?.key ?? null,
      uploadFrontBytes: upload?.front?.byteLength ?? null,
      uploadBack: upload?.back?.key ?? null,
      uploadBackBytes: upload?.back?.byteLength ?? null,
      uploadCheckedAt: upload?.checkedAt ?? null,
      uploadApprovedAt: upload?.approvedAt ?? null,
      printFileKey: upload?.printFileKey ?? null,
    })
  )
}

export function designFingerprintForCampaign(campaign: DesignFingerprintSource): string {
  return designFingerprint(campaign)
}

/** Changes when any recipient changes. Row order does not matter. */
export function listFingerprint(recipients: readonly Recipient[]): string {
  const lines = recipients.map((recipient) =>
    [
      recipient.first,
      recipient.last,
      recipient.organization,
      recipient.address1,
      recipient.address2,
      recipient.city,
      recipient.state,
      recipient.zip,
    ]
      .map((part) => part.trim().toUpperCase())
      .join("|")
  )
  lines.sort()
  return sha256Hex(lines.join("\n"))
}
