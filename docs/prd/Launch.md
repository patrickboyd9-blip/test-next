# Launch PRD

## Document status

**Draft product specification** for Launch in Modern Mail. Not an implementation plan. Not an architecture document.

| Precedence | Document |
|---|---|
| 1 | Product Bible |
| 2 | UX Manifesto |
| 3 | AI System |
| 4 | Campaign Creator |
| 5 | Production ADRs 008–015 (`docs/PRODUCTION_ARCHITECTURE_DRAFT.md`) |
| 6 | **This PRD** |

When this PRD is silent, defer to the documents above. When those documents conflict, this PRD records the conflict rather than silently resolving it.

`docs/PROJECT_BLUEPRINT.md` remains the named architecture/roadmap file. It is **stale** relative to Campaign Creator, milestones v0.8, and ADRs 008–015 (it still treats Click2Mail evaluation / mailer PDF as the next step). This PRD follows Campaign Creator + ADR-015 for Launch, not the Blueprint’s paused “evaluate Click2Mail” stopping point.

**Three layers (do not collapse):**

| Layer | Owns |
|---|---|
| **Customer experience** | What the customer sees, reviews, pays for, and explicitly commits |
| **Modern Mail domain** | `quantity_confirmed`, review (no extra status), payment-as-gate, `launched`, `MailPiece`, `ProductionDocument` |
| **Fulfillment** | PDF/artifact, adapter, Click2Mail job, vendor submit/state, mailing, delivery |

**Kind labels used below**

- **Established** — already required by existing docs/ADRs/code
- **This PRD** — product contract this draft specifies where a Launch PRD was required to decide
- **Unresolved** — sources do not authorize an answer; do not implement as if decided

---

## Status

Draft

---

## Problem

The implemented campaign journey stops at `quantity_confirmed`. Progress already shows Launch as active. There is no review screen, no cost, no pay, no launch action, and nothing writes `launched`.

`deriveProductionDocument()` exists and has no caller. ADR-015 forbids creating a ProductionDocument at approval, audience, or quantity, and forbids treating `quantity_confirmed` as manufacture authorization.

Without Launch, Modern Mail cannot keep the Campaign Creator promise: review → pay → explicit commit → then fulfillment. Customers also cannot be certain the campaign was submitted (`docs/CAMPAIGN_CREATOR.md`). Engineering Principles require a PRD before this major feature.

---

## Product Intent

**Established:** Launch is where the customer reviews, approves, and launches with confidence (Product Bible). The question v0.8 answers is: *Am I ready to commit and send?* (Milestones). Studio approval is “this is what we’ll print and mail” until audience is confirmed — it is **not** Launch (Creative Studio PRD).

**This PRD:** Launch is the customer-facing commit to send the already-approved `MailPiece` to the already-confirmed audience and quantity, after seeing a concise final review that includes total cost. It is the ADR-015 event:

> Modern Mail may manufacture this campaign.

Launch is not Creative Studio, not a second creative approval, not a print-vendor console, and not “the mail arrived.”

---

## User Journey

**Established entry:** Audience is confirmed, then Quantity & tracking is confirmed. Status → `quantity_confirmed`. Progress: Launch = active. (`campaign-status.ts`, `CampaignCreatorView`, Campaign Creator steps 1–3.)

**This PRD — immediately after `quantity_confirmed`:**

1. Stay on `quantity_confirmed`. **Do not add a review status.**
2. Show the **Launch review** (Campaign Creator “Launch review”; Creative Studio appendix assigns it to Campaign Creator, not Studio).
3. Customer reviews the frozen campaign (section Final Review) including **total cost**.
4. Customer explicitly commits (section Launch / Commitment). Payment is a **customer gate** on that path (section Payment).
5. The customer’s explicit Launch action is the production commitment event. `launched` semantically records that customer commitment. Payment remains a required customer gate before fulfillment. **Do not treat this step as deciding whether payment success must complete before, during, or after the `launched` write** — that transactional sequencing stays unresolved (ADR-015).
6. Tell the customer the campaign has been launched and what happens next (Campaign Creator).
7. Only then may the production path open (ADR-015). Fulfillment remains downstream.

**Tracking:** **This PRD** — confirmation stays on the existing Quantity & tracking stage. Launch review **summarizes** tracking. It does not re-collect QR, phone, website, or quantity.

**Customer does not see:** Click2Mail, job IDs, `documentClass`, bleed, ProductionDocument, renderer, or a new design editor.

**AI does not:** auto-launch, auto-pay, or auto-submit (AI System).

---

## Final Review

**Question this screen answers:** *Am I ready to commit and send?*

**Established contents** (`docs/CAMPAIGN_CREATOR.md`):

- What is being sent
- Who it is being sent to
- Quantity
- Primary Success Metric
- Tracking, when applicable
- Final creative
- Total cost

Purpose: **confidence**, not more configuration.

**This PRD:** Read-only summary. Edits happen by going back to earlier stages (audience/quantity while those remain editable per current UI; creative via existing unapprove only while still `creative_approved`). Launch review does not mint a new `MailPiece` version.

### Already on Campaign vs future

| Review item | Today | Gap |
|---|---|---|
| What is being sent | Current `MailPiece` + catalog identity | Production-accurate proof is not Studio `PostcardPreview` (ADR-006/007). Review may show the existing preview as the customer-facing creative; print-proof is fulfillment, not this screen. |
| Who | `brief.audience.description` | Actual mailing **list** vs definition — see Mailing list |
| Quantity | `brief.audience.quantity` + `quantity_confirmed` | — |
| Primary Success Metric | `brief.primarySuccessMetric` | — |
| Tracking | QR / phone / website on brief, confirmed in Quantity & tracking | — |
| Final creative | Frozen `MailPiece.spec` / `approvedSpec` | Launch is not another Studio approval |
| Total cost | **Not implemented** | Must be **shown**; how it is calculated is unresolved (Pricing) |

---

## Final creative / MailPiece

**Established:**

- `approveCreative` persists the current `MailPiece`. That is the frozen approved artifact (ADR-012).
- Launch review is not Studio and not a second approval (Creative Studio PRD).
- `addressFaceAuthorship` stays on `MailPieceSpec` (ADR-010, ADR-015).
- MailPiece fields do not change in this PRD.

**This PRD:** Final review **references** `campaign.mailPiece` (current only). It does not scan `mailPieceVersions`. It does not create ProductionDocument. Creative shown is that MailPiece’s spec via the existing Studio preview convention, labeled as what will be sent — not as a vendor proof.

---

## Pricing

**Established:** Final review includes **total cost**. v0.8 ships a review of creative + audience + quantity + cost. No pricing code exists in the repo.

**This PRD:** Display a single customer-facing **total cost** on Launch review before commit. Do not expose vendor rate cards, postage SKUs, or Click2Mail `costEstimate` as the UX.

**Unresolved (do not invent):**

- Rate card, volume breaks, print vs postage vs list cost
- Estimate vs final charge
- When/how cost is computed
- Tax, credits, refunds
- Mapping to any vendor estimate API

A future pricing design owns those. Launch still cannot ship without *presenting* a total; the number’s source is not specified here.

---

## Payment

**Established:**

- Customer explicitly approves **the campaign and payment** before fulfillment submission (Campaign Creator).
- After that approval, say the campaign has been launched; they must not wonder if it was submitted.
- AI must not spend without explicit approval (AI System).
- Click2Mail charges at **vendor job submit**, with its own `billingType` (diligence). That is **fulfillment-layer** payment, not Modern Mail campaign status.
- ADR-015: payment is a required gate **before fulfillment submission**. Payment success **is not** defined as equivalent to `launched`.

**This PRD (smallest product contract):**

1. Payment is a **customer gate** on the Launch path, not a new `CampaignStatus`.
2. The customer must see total cost and accept the charge as part of launching.
3. The customer’s explicit Launch action is the production commitment event. `launched` semantically records that customer commitment. Payment is required before fulfillment is submitted. This does **not** decide whether payment success is a precondition for the `launched` write, a sibling confirmation, or only a later gate before provider submit.
4. Fulfillment must not be submitted if that payment gate was not completed.
5. Do not fold vendor pay-at-submit into `Campaign.status`.

**Unresolved:**

- Payment processor / Modern Mail checkout vs beta equivalent vs provider-side pay-at-submit
- Whether payment **success** must complete **before** the `launched` write, as a sibling confirmation, or only before provider submit (ADR-015)
- PCI, refunds, failed charges after `launched`
- Two-button vs one-button UX (pay, then launch vs one “Approve and launch”)

This PRD requires the **gate** and the **commit**. It does not pick a processor or collapse vendor billing into `launched`.

---

## Launch / Commitment

**Established (ADR-015):** The production commitment boundary is the customer’s **explicit launch/commit after post-quantity final review.**

That event means: *Modern Mail may manufacture this campaign.*

**This PRD:** The customer-facing action is an explicit Launch confirmation on the review screen (copy later; meaning is commit-to-send). It is not implied by scrolling, by `quantity_confirmed`, or by AI.

That explicit Launch action **is** the production commitment event. `Campaign.status = "launched"` **semantically records** that customer commitment. Payment is a required customer gate before fulfillment. The exact transactional sequencing of payment success versus the `launched` write remains **unresolved**, as ADR-015 states. Do not implement as if payment success and `launched` were the same event, and do not implement as if `launched` could be written while skipping the payment gate before fulfillment.

After a completed customer Launch commitment:

- The customer is told the campaign launched and what happens next.
- Production path **may** open. ProductionDocument, artifacts, and provider jobs are not this click’s customer meaning.

`launched` **does not mean:** Click2Mail submit succeeded, print started, mailed, delivered, ProductionDocument exists, or payment-provider success (that last equivalence remains **unresolved**).

AI cannot perform this action.

---

## Campaign State

**Established statuses (unchanged):**

```
… → audience_confirmed → quantity_confirmed → launched
```

No new status for review, payment, ProductionDocument, or vendor jobs (ADR-012, ADR-015).

| Status | Meaning in Launch |
|---|---|
| `quantity_confirmed` | Audience + quantity + tracking confirmed. Ready for **review / pay / launch**, not manufacture. |
| (review shown) | Still `quantity_confirmed`. |
| `launched` | Customer committed to send. Manufacture authorized. Not payment-provider success, not vendor submit. |

**This PRD:** If the customer leaves mid-review, they resume at `quantity_confirmed` on Launch review. Progress step Launch stays active until `launched`.

Do not use `launched` as mail-status or Click2Mail status.

---

## ProductionDocument Boundary

**Established (ADR-012–015):**

Customer final review / payment gate / commitment  
→ `launched` (customer commit)  
→ production path opens  
→ `ProductionDocument` (vendor-neutral interpretation)  
→ serialized artifact (future; e.g. PDF)  
→ vendor adapter  
→ provider job  

- Not before commitment.
- After authorization to manufacture, **before** vendor-specific jobs.
- Fields stay ADR-013. `deriveProductionDocument()` stays uncalled until a post-commit production path exists.
- Not a Campaign status. Persistence is campaign JSON when that path first interprets the current `MailPiece`.

**Unresolved (preserve ADR-015; this PRD does not pick):**

- Same write as `launched`
- Later production-path step after `launched`, still before provider submit
- Later step after payment if payment is a distinct event from launch confirmation

Must not persist before commitment or as a vendor job record.

---

## Fulfillment Handoff

**Established:** Fulfillment is after customer commit. Fully automated fulfillment may stay constrained in beta (Campaign Creator). Click2Mail create vs submit vs `AWAITING_PRODUCTION` is a **second** state machine (diligence). v0.7 “production partner” is not the customer Launch definition (v0.8). **Conflict recorded:** milestones list v0.7 before v0.8; Campaign Creator submits fulfillment **after** pay/launch. This PRD does not reorder milestone numbers; it forbids treating Click2Mail as the commitment event.

**Downstream of Launch (not Campaign.status):**

- Renderer / PDF / proofs
- Postage as vendor/job option
- Address-list upload to a provider
- Click2Mail document/job/create/submit
- Vendor payment rails at provider submit
- Vendor polling
- In-flight / delivered measurement (Command Center)

**This PRD:** After `launched`, tell the customer next steps in Modern Mail language (campaign is committed; we’ll print and mail). Do not show vendor job states as campaign status.

---

## Mailing list

**Established:** Audience **definition** ≠ actual list (Product Bible, Campaign Creator). Quantity can be confirmed on the brief. Final review includes “who it is being sent to.” v0.5/v0.6 cover list upload / Data Axle. You cannot physically mail without addresses.

**This PRD:** Launch review must show the confirmed **who** and **quantity** already on the campaign. Do not invent Data Axle or upload UX here.

**Unresolved:** Whether a built mailing list is a **prerequisite to write `launched`**, or only a **prerequisite to provider submit**. Do not block this PRD on v0.6. Do not treat `quantity_confirmed` as “list ready.”

---

## Failure and Retry

**Established:**

- If ProductionDocument inputs are missing, do not create one (ADR-012).
- Renderer / PDF / provider failures are after the domain object, or later artifact/job steps; they must not block creative approval (ADR-012).
- Do not model render / vendor-pay / vendor-submit failure as “not launched” unless a later decision defines rollback of `launched` (ADR-015). Rollback is **unresolved**.
- After a successful launch, the customer must not be uncertain whether the campaign was submitted (Campaign Creator).

**This PRD:**

- If the customer never completes Launch confirmation, stay `quantity_confirmed`. No ProductionDocument.
- Launch UI must distinguish: not committed yet vs committed.

**Unresolved — do not invent:**

- Card decline / payment failure during commit
- `launched` write succeeds, payment capture fails
- `deriveProductionDocument` throws after `launched`
- Render/PDF failure
- Provider submit failure / retry
- Whether `launched` can be reverted
- Timeouts, idempotent re-click, duplicate charge

---

## AI Boundaries

**Established (AI System):**

AI **must not** launch, print, spend, or submit fulfillment without explicit customer confirmation. Explicit approval for anything that commits, spends, or launches. Customer is the final decision-maker.

AI **may** (when reversible / already implied): summarize the review, explain why this audience/quantity/creative fit the goal, recommend the next action (“Review and launch when you’re ready”).

**This PRD:** No autonomous Launch. No silent ProductionDocument. No Click2Mail in customer copy.

---

## UX Requirements

**Established:** Calm, premium, clear progress (UX Manifesto). Complexity belongs to Modern Mail, not the customer (Product Bible / Founder manifesto: not VistaPrint). Launch should feel like confidence, not a vendor form.

**This PRD:**

- One question: *Am I ready to commit and send?*
- Answer first, then the review evidence (UX Manifesto principle 2).
- Total cost visible before commit.
- Explicit commit control; not a hidden side effect.
- After a completed customer Launch commitment: unmistakable “this campaign launched” plus next steps.
- No Click2Mail / job / bleed / ProductionDocument in the UI.
- Tracking already confirmed; don’t make Launch a second tracking form.
- Do not expose technical production choices the customer is not supposed to make (`addressFaceAuthorship` is platform-selected in beta).

---

## Scope

### In scope

- Post-quantity Launch review (no new status)
- Summary: MailPiece creative, audience, quantity, tracking, Primary Success Metric, total cost (display)
- Explicit customer commit → `launched` as the semantic record of that commitment
- Payment as a customer gate before fulfillment (product contract only; sequencing vs the `launched` write remains unresolved)
- ADR-015 ProductionDocument boundary
- Fulfillment handoff boundary
- Failure/retry **requirements at contract level** (stay `quantity_confirmed` if not committed; don’t fold vendor failure into status without a rollback decision)
- AI must not commit/spend/launch

### Out of scope

- Click2Mail implementation, adapters, PDF renderer, artwork generation
- Payment-provider integration, pricing engine
- Data Axle / list-import implementation
- New production state machine or new Campaign statuses
- Creative Studio redesign
- MailPiece / MailPieceSpec / ProductionDocument field changes
- Snapshotting `addressFaceAuthorship` onto MailPiece
- Calling `deriveProductionDocument()` from approval, audience, or quantity

---

## Acceptance Criteria

Product-level (not implementation):

1. After `quantity_confirmed`, the customer can enter Launch review without a new Campaign status.
2. Review shows what, who, quantity, Primary Success Metric, tracking, frozen creative (current MailPiece), and total cost.
3. Tracking is summarized, not re-collected.
4. Launch review does not create a MailPiece version or open Studio approval.
5. A `ProductionDocument` does not exist before explicit commit.
6. Only an explicit customer Launch action is the production commitment event; `launched` records that customer commitment. AI cannot perform that action.
7. Payment is required as a customer gate before fulfillment. Launch implementation must not treat payment-success ≡ `launched` as settled.
8. `launched` is not assigned from Click2Mail or other vendor states.
9. No new Campaign status for review, payment, ProductionDocument, or vendor jobs.
10. After a completed customer Launch commitment, the customer is told the campaign launched and is not left unsure.
11. Click2Mail / job / documentClass / bleed do not appear in Launch UX.
12. If the customer does not complete commit, status remains `quantity_confirmed`.
13. `deriveProductionDocument` is not invoked from `approveCreative`, `confirmAudience`, or `confirmQuantity`.

---

## Open Questions / Deferred Decisions

Preserve these; do not treat as implied by this draft:

1. Payment success vs `launched` write vs later fulfillment gate (ADR-015).
2. One vs two customer confirmations (pay, then launch).
3. Payment processor / Modern Mail vs provider pay-at-submit.
4. Pricing mechanics behind total cost.
5. ProductionDocument persist timing inside the opened path (same write as `launched` vs later, still before vendor job).
6. Provider submission timing relative to `launched`.
7. Mailing-list readiness: launch prerequisite vs fulfillment-only prerequisite.
8. Whether `launched` can be reverted; payment/PD/render/provider failure and retry.
9. Milestone numbering: v0.7 Click2Mail vs v0.8 Launch vs Campaign Creator order.
10. Return-address content ownership (prior ADRs).
11. Production-accurate proof on Launch vs Studio preview until a renderer exists.
12. Exact Launch CTA copy (Studio has approval copy; Launch copy is not specified).

---

## Source Grounding

| Decision | Source | Kind |
|---|---|---|
| After quantity: review → price → pay → launch → fulfillment | `docs/CAMPAIGN_CREATOR.md` handoff | Established |
| Final review fields + total cost; confidence not configuration | Campaign Creator, Final Review | Established |
| Pay/approve before fulfillment; then “launched”; no uncertainty | Campaign Creator, Payment and Launch | Established |
| Tracking confirmed before review | Campaign Creator step 3; existing Quantity & tracking stage | Established; **this PRD** keeps it off Launch as a form |
| Launch review is Campaign Creator, not Studio | Creative Studio PRD appendix | Established |
| Creative approval ≠ launch; reversible until audience | Creative Studio PRD; ADR-012 | Established |
| v0.8: review, payment, launch confirmation, `launched` | `docs/MILESTONES.md` | Established |
| `quantity_confirmed` → Launch progress active; no writer for `launched` | `campaign-status.ts`, repository | Established |
| Commitment = explicit launch/commit; `launched` records it; no new status | ADR-015 | Established |
| PD after commitment, before vendor jobs; persist timing unresolved | ADR-015, ADR-012 | Established / unresolved |
| AI must not launch/print/spend | `docs/AI_SYSTEM.md` | Established |
| Vendor job states ≠ campaign status | `docs/CLICK2MAIL_DUE_DILIGENCE.md` | Established |
| Definition vs actual mailing list | Product Bible; Campaign Creator | Established; launch-vs-fulfillment list gate **unresolved** |
| No pricing/payment implementation today | repository | Established |
| Stay `quantity_confirmed` during review; summarize not edit | this PRD | **This PRD** |
| Payment is a gate before fulfillment, not a status; Launch action is the commitment; sequencing vs `launched` write unresolved | this PRD + ADR-015 | **This PRD** / unresolved processor and sequencing |
| Do not invent pricing engine or Click2Mail UX | this PRD | **This PRD** |
| Blueprint “Click2Mail next” | `docs/PROJECT_BLUEPRINT.md` | Stale vs this PRD |
| v0.7 before v0.8 vs pay-then-fulfill | Milestones vs Campaign Creator | **Conflict recorded, not resolved** |
