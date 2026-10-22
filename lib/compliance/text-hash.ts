import { accountPlainText, campaignPlainText } from "./legal-text"
import { sha256Hex } from "./hash"

/** SHA-256 of the exact account text shown, including the linked document bodies. */
export function accountTextHash(): string {
  return sha256Hex(accountPlainText())
}

/** SHA-256 of the exact campaign checkbox and warning text shown for one industry. */
export function campaignTextHash(industryId: string): string {
  return sha256Hex(campaignPlainText(industryId))
}
