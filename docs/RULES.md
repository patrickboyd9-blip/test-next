# Product rules

Each rule has a test that CI runs. A failure means the rule was broken.

| Rule | Test |
| --- | --- |
| The price shown is the full price, not postage by itself. Until a schedule is set, the label is Placeholder and nothing is charged. | `lib/ops/rules.test.ts` |
| Nothing is charged unless that account has an approval on the record. Stripe test checkout opens only after that approval, for the full price, and `charged` becomes true only from a verified webhook. A live secret key does not run unless `STRIPE_LIVE_ENABLED` is true. | `lib/ops/rules.test.ts`, `lib/ops/stripe.test.ts` |
| Comet does not reveal partners, model or hosting names, internal costs, prompts, or research sources. Prompt-injection attempts get a deflection. | `lib/ops/rules.test.ts`, `lib/assistant/help.test.ts` |
| Address boxes stay 265.5×208 pt on 5×8 and 263×213 pt on 6×9. Barcode zones stay 433×46 pt and 432×47 pt, anchored from the bottom-right of the trim. | `lib/ops/rules.test.ts`, `lib/print-spec/barcode-clear-zone.test.ts` |
| Research photographs are not committed. | `lib/ops/rules.test.ts` |
| Private keys and live payment secrets are not committed. | `lib/ops/rules.test.ts` |
| One account cannot read or write another account's campaign. | `lib/auth/account-boundary.test.ts` |
| AI and mail actions slow down after a short burst. | `lib/ops/rules.test.ts` |
| Create, proof, price, approve, send, charge, and a scan are recorded in an append-only log. | `lib/ops/audit.ts`, `lib/ops/mail-flow.ts`, `lib/ops/rules.test.ts` |
| A mailer QR sits outside the address panel and the barcode clear zone. A scan stores time, campaign, and recipient id, then forwards. Empty results stay empty. | `lib/tracking/tracking.test.ts` |

The log has no update or delete. It records who acted, which record, when, and a before and after snapshot.
