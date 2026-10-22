/**
 * Compliance clickwrap hook.
 *
 * The clickwrap (a separate change, not merged yet) must be accepted before
 * Stripe Checkout starts. That change should:
 * 1. Render inside the element marked `data-compliance-hook="before-payment"`.
 * 2. Call `recordComplianceAcceptance` (or write `campaign.complianceAcceptance`
 *    with the same shape) using its own terms version.
 * 3. Leave payment below that element. Checkout refuses to start until
 *    `complianceAccepted` is true on the saved campaign.
 *
 * Until that change lands, the hook records version `checkout-hook` so the
 * payment path can be tried. It is not the legal clickwrap.
 */

export const COMPLIANCE_CHECKOUT_HOOK = "before-payment"

/** Stand-in version written when the clickwrap has not supplied its own. */
export const CHECKOUT_HOOK_TERMS_VERSION = "checkout-hook"

export interface ComplianceAcceptance {
  acceptedAt: string
  /** Terms version. The clickwrap agent owns the real values. */
  version: string
}

export function complianceAccepted(acceptance: ComplianceAcceptance | null | undefined): boolean {
  return Boolean(acceptance?.acceptedAt && acceptance.version.trim())
}

export function complianceBlockMessage(): string {
  return "Accept the mailing terms before payment. Nothing is sent until you do."
}
