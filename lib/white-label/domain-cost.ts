/**
 * Published list prices for a custom domain. Nothing here is purchased,
 * connected, or quoted for this account. Figures checked 2026-11-18.
 * Vercel: https://vercel.com/docs/limits and https://vercel.com/docs/plans/pro-plan
 * Resend: https://resend.com/pricing
 */

export const DOMAIN_COST_AS_OF = "2026-11-18"

export const DOMAIN_COST_LINES = [
  "A custom domain is not connected. These are published list prices, not a quote.",
  "Vercel does not charge per domain you attach. Hobby includes 50 domains on a project. Pro is $20 a month per deploying seat and includes domains up to a soft limit of 100,000. Buying or transferring the name is a separate registrar fee that depends on the ending.",
  "Resend’s free plan includes 3 custom sending domains, 3,000 emails a month, and 100 emails a day. Pro starts at $20 a month and includes 10 domains. One hundred more domains are a $20 a month add-on on Pro and Scale.",
] as const
