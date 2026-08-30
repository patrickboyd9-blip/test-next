# AI Creative Engine — Product Specification

## Document status

**Product design specification for v0.4.0 (AI Creative Engine).**

| Precedence | Document |
|---|---|
| 1 | Product Bible |
| 2 | UX Manifesto |
| 3 | AI System |
| 4 | Campaign Creator |
| 5 | Creative Studio PRD |
| 6 | Creative Refinement PRD |
| 7 | **This document** |

When this document conflicts with a higher-precedence document, **stop and ask** — do not silently resolve the conflict.

When the Creative Studio or Creative Refinement PRD specifies customer-facing Studio behavior, those documents still govern the UI. This document governs **what intelligence sits behind that UI** and the small surface additions required to make generation, refinement, and regeneration real.

**Companion release doc:** [`docs/MILESTONES.md`](../MILESTONES.md)

**Scope:** **v0.4.0** — Anthropic-backed generation and refinement behind the existing `CreativeEngine` interface; regeneration flow; generation error recovery; mock fallback when no API key is configured.

**Founder decisions (2026-08-29):**

| Decision | Resolution |
|---|---|
| Proceed with v0.4.0 as proposed | Approved |
| Logo file upload | **Out of scope.** Leave existing UI disabled. File upload is a later milestone. |
| Mock fallback | **Keep.** When `ANTHROPIC_API_KEY` is not configured, Studio uses the mock engine. |
| LLM-enriched generation narration | **Deferred.** Keep brief-templated narration from Creative Studio PRD §5.1. |

**Out of scope for v0.4.0:** Logo file upload/storage, image generation, audience/fulfillment integrations, payment, Command Center live data, background job infrastructure, new npm packages, a test runner.

---

## 1. Purpose

### Question this milestone answers

> *Does the creative actually respond intelligently to my campaign and my words?*

### Why v0.4.0 exists separately from v0.3.0

v0.2.0 proved Modern Mail **presents** creative work like an agency.  
v0.3.0 proved the customer can **shape and approve** it through language, history, and explicit approval.  
v0.4.0 proves the work is **theirs** — generated from their brief, refined from their words — not a hardcoded HVAC sample with a regex parser.

Without a real engine, Studio is a polished rehearsal. With it, Studio keeps the Product Bible promise: the customer describes the campaign; Modern Mail figures out the configuration.

### What must not change

The customer-facing Studio from v0.2.0 and v0.3.0 is complete enough. This milestone **swaps the intelligence**, not the room.

Do not redesign:

- Lead-first reveal, compare, focus, refinement room, approval interstitial
- Revision history, restore, region highlighting, sticky footer
- Approval / unapprove / persistent header / audience handoff
- Natural-language-only refinement (no edit panels, no canvas)

v0.3.0 captured structured `SpecDiff` on every change **so this swap would not change the customer-facing experience.** Keep that contract.

### Relationship to the AI System

The AI is not a chatbot bolted onto Studio. It is the same strategist as the interview — Presentation mode when revealing work, Collaboration mode when refining.

Customers should never feel like they are operating a model. They should feel like they hired a designer who already understands the campaign.

---

## 2. Entry and exit

Studio entry and exit are unchanged from Creative Studio PRD §2 and Creative Refinement PRD §2.

v0.4.0 adds one real path that v0.3.0 left as a dead control:

| From | Action | Lands in |
|---|---|---|
| Lead reveal | **None of these feel right** | Feedback composer |
| Feedback | Submit | Generation (regeneration) → Lead reveal |
| Feedback | Cancel | Lead reveal (no state loss) |
| Feedback | Cap reached (2 regenerations) | Stay in feedback; show cap copy; no further generation |

Approve-as-is remains a valid happy path. Regeneration is not required to approve.

---

## 3. Customer experience

### 3.1 Generation

**Primary question:** *Is Modern Mail working on something for me?*

Unchanged from Creative Studio PRD Phase 1, with one implementation change:

- Generation **starts immediately** when Studio opens after strategy confirm. There is no second “Generate” button and no fake wait-then-write of mock HVAC directions.
- Narrative lines continue to come from the brief templates in Creative Studio PRD §5.1.
- Narrative runs until generation **finishes or fails** — not until a predetermined timer.
- Slow state at 15 seconds; second slow line at 30 seconds; failed state at 45 seconds or on provider error.

**Success:** Status → `creative_ready`. Lead concept reveal begins automatically. Directions reflect the **confirmed brief** (business, offer, metric, audience, tone) — not ABC Air defaults.

**Failure:** Stay in generation. Show Creative Studio PRD §5.10 copy and **Try again**. Spec and directions remain empty. Retry calls the engine again.

### 3.2 Lead, compare, focus, refine, approve

Unchanged. See Creative Studio PRD Phases 2–7 and Creative Refinement PRD §§3–8.

The difference is **content quality**:

- Direction names, rationale, tags, and spec copy come from the live brief.
- Refinement prompts the mock parser cannot handle still produce a meaningful spec change or a single clarifying question.
- Studio-voice confirmation is Collaboration mode — short, specific, no “AI,” “generated,” or “model.”

### 3.3 Regeneration

**Primary question:** *Can I get a new set of directions without restarting the campaign?*

Copy and behavior: Creative Studio PRD §5.7.

1. Customer taps **None of these feel right**.
2. Composer activates with label **Tell us what’s not landing.**
3. Customer submits feedback (or cancels back to lead reveal).
4. Studio-voice confirmation: *Got it — I’ll create three new directions with {constraintSummary}.*
5. Generation screen returns. On success, a new lead reveal replaces the previous set.

**Cap:** Maximum **2** full regenerations per campaign. After the cap:

> We've explored several directions. Tell me what you'd like to adjust in your strategy, or pick the closest option and refine it from there.

The customer must select a direction and refine, or edit strategy. The product does not keep generating.

Regeneration **replaces** the direction set and revision stacks. The campaign brief is unchanged. Prior refinements on discarded directions are not carried forward.

### 3.4 Logo chip

Leave existing disabled UI in place. Do not add upload, storage, or a working “Add my logo” path.

If the customer *describes* a logo in a refinement prompt, the engine may acknowledge the request in studio-voice and may set `imagery: logo_primary` on the spec. No file is stored. Do not pretend an uploaded logo is on the postcard.

---

## 4. Engine contract

Callers depend only on the existing `CreativeEngine` interface in `lib/campaign-creator/creative-engine.ts`. Do not invent a second provider API.

```
generateDirections({ brief }) → { directions[3], recommendation, recommendedDirectionId }
refineDirection({ brief, direction, revisions, prompt }) → { spec, revision, conflict? }
regenerateDirections({ brief, feedback, previousDirections }) → same as generate
```

### 4.1 Provider selection

Mirror `getConversationEngine()`:

| Condition | Engine |
|---|---|
| `ANTHROPIC_API_KEY` is set, and `CREATIVE_ENGINE` is not `mock` | `AnthropicCreativeEngine` |
| No API key, **or** `CREATIVE_ENGINE=mock` | `MockCreativeEngine` |

`MockCreativeEngine` wraps the existing mock generation (`getMockCreativeDirections`) and mock refinement (`applyMockRefinement`). Studio must remain completable offline and in CI.

`PlaceholderCreativeEngine` must not remain the default. An unconfigured environment degrades to mock, not to a thrown placeholder.

Do not add a new npm package. Use the already-installed `@anthropic-ai/sdk`. Use the same model family as the interview engine so Studio and Interview feel like one teammate.

### 4.2 What the model returns vs what we compute

The model proposes **content**. Our code owns **truth**.

| Concern | Owner |
|---|---|
| Direction names, rationale, tags, spec copy, studio-voice line | Model (Anthropic path) |
| `SpecDiff` / `changedRegions` | Always `buildSpecDiff(before, after)` — never the model |
| Revision `id`, `createdAt`, `version` | Server / repository |
| Conflict when required elements would be removed | Deterministic guard **after** the model, even if the model said success |
| Required brief fields missing from a spec | Faithfulness re-injection from the brief |
| Generation constraint failures | Server validation; one automatic retry; then fail |

### 4.3 Generation constraints (Creative Studio PRD §6.6)

A generation or regeneration result is valid only if **all** of the following hold:

- Exactly 3 directions
- Exactly one `recommended: true`
- At least 2 distinct `layoutVariant` values
- All 3 messaging angles differ (headline + rationale are not paraphrases of each other)
- Every required `CreativeDirection` and `CreativeSpec` field is present (Studio PRD §§6.1–6.2)
- Required brief elements (offer, phone, QR/website, when present in the brief) appear on every direction
- `format` is `postcard_4x6`; `backLayout` is `standard_address`
- `imagery` is one of the existing keys: `stock_hvac` \| `stock_restaurant` \| `stock_generic_local` \| `logo_primary` \| `none`

Invalid result: retry the provider once. If still invalid, treat as generation failure.

### 4.4 Refinement contract

On success:

- Return a **full next spec snapshot**, not a patch
- `studioResponse` in Collaboration mode (Creative Studio PRD §5.5)
- Server computes `specDiff` and appends a `type: "refinement"` revision

On conflict (model or guard):

- Spec **does not change**
- `type: "conflict"` revision, `version: null`
- Assertive studio-voice; one alternative or one clarifying question
- Composer stays enabled; prompt preserved

Conflict when the request would:

1. Remove or hide the Primary Success Metric path (QR when metric is QR/appointments via QR; phone when metric is phone calls)
2. Remove required brief elements (offer when offer-led; required phone/website)
3. Contradict the stated goal without the customer explicitly changing strategy

Ambiguous prompts (“make it better”) ask one clarifying question. They do not mutate the spec.

If the model’s `studioResponse` is empty or contains banned phrasing (“as an AI”, “I’ve generated”, model/tool names), replace it with the existing template builder from `specDiff`.

### 4.5 Structured output

Use forced `tool_choice` — the same pattern as `AnthropicConversationEngine`. Do not parse freeform prose into a spec.

The customer never sees tools, schemas, tokens, or provider names.

### 4.6 Facts the model must not invent

The interview engine already forbids inventing customer-specific facts. The creative engine inherits that rule.

If the brief does not contain a phone number, offer, website, or business name, the model must not fabricate one. Prefer a safe omission or a generic formulation over a fake phone number. Faithfulness re-injection applies only to fields **actually present** on the brief.

---

## 5. Generation lifecycle

### Persisted status

| Status | When |
|---|---|
| `strategy_confirmed` | Customer confirmed strategy; Studio opening |
| `generating_creative` | Generation or regeneration in flight — **persist this** (today it is client-only) |
| `creative_ready` | Three valid directions stored |
| `creative_approved` | Unchanged from v0.3.0 |

`generating_creative` remains a campaign status, not a UI-only flag. Persist it at the **start** of the generate/regenerate action.

### Timing (Creative Studio PRD §8.5)

| Threshold | UI |
|---|---|
| Immediate | Start the engine call; show generation stage + narrative |
| 15s | Slow narration line |
| 30s | Second slow line |
| 45s or thrown error | Fail + **Try again** |
| Refinement 8s | “Applying your change…” |
| Refinement 20s | Inline slow-network copy; spec unchanged; retry |

Do not wait for a client timer *before* calling the engine. `STUDIO_GENERATION.totalDurationMs` must not gate the provider call. Narrative interval and slow thresholds remain.

### Refresh mid-generation

If the customer refreshes while status is `generating_creative` and directions are empty, Studio retries generation. Do not build a background job queue in v0.4.0.

### Imagery

Beta still renders templates plus curated stock keys. The engine **chooses** an `imagery` key from the brief’s industry/business — it does not generate pixels.

---

## 6. Regeneration details

Persist `regenerationCount` on `CampaignCreative`. Increment only after a **successful** regeneration.

| Count | Behavior |
|---|---|
| 0 or 1 | Feedback submit → confirmation → generate new set |
| 2 | Cap copy; do not call the engine |

`regenerateDirections` receives the previous directions so the model can avoid repeating the same angles.

After success:

- Replace `creative.directions`, recommendation, and revision stacks (new v1 “original concept” per direction)
- Clear `selectedDirectionId` / `activeSpec` as today when applying a new generation set
- Return to lead reveal
- Do not touch `brief` or campaign identity

---

## 7. Copy

All Studio copy remains Presentation or Collaboration mode per AI System. Never chat bubbles. Never “As an AI…”. Never “Generated.”

- Generation narration: Creative Studio PRD §5.1 (templates only in v0.4.0)
- Lead / compare / focus: §5.2–5.4 — values come from the engine, labels stay fixed
- Refinement success / conflict: §5.5–5.6 — model may phrase the line; templates are the fallback
- Regeneration: §5.7
- Approval / handoff: §5.8–5.9 — unchanged
- Errors: §5.10

Banned in any customer-visible string: “AI”, “language model”, “Claude”, “Anthropic”, “prompt”, “tokens”, “tool”, “schema”, “generated for you.”

---

## 8. Architecture alignment

This section records how v0.4.0 fits the **current** codebase so implementation does not invent a parallel stack.

### Existing pieces to reuse

| Piece | Role |
|---|---|
| `CreativeEngine` | Provider interface — already has generate / refine / regenerate |
| `applyGeneratedDirections` | Maps engine output onto `CampaignCreative` |
| `AnthropicConversationEngine` | Pattern for forced tools + system prompt |
| `applyMockRefinement` / `getMockCreativeDirections` | Become `MockCreativeEngine` internals |
| `buildSpecDiff` / `cloneSpec` | Deterministic diffs |
| `metricUsesQr` / `metricUsesPhone` | Conflict guard inputs |
| Studio views | Unchanged except wiring dead regeneration link + fail/retry on `GenerationView` |
| File repository | Same persistence; add `regenerationCount` + persist `generating_creative` |

### Existing pieces to stop calling from actions

| Today | After v0.4.0 |
|---|---|
| `initializeStudioCreative` writes `getMockCreativeDirections` after a client timer | Action calls `getCreativeEngine().generateDirections` immediately |
| `applyRefinement` calls `applyMockRefinement` directly | Action calls `getCreativeEngine().refineDirection` |
| `getCreativeEngine()` returns `PlaceholderCreativeEngine` | Returns Anthropic or mock |

### New / small UI

| Component | Responsibility |
|---|---|
| `FeedbackComposer` | Regeneration prompt (Creative Studio PRD §7.2). Reuse `StudioComposer` patterns; do not invent a chat thread. |
| `GenerationView` | Add failed state + **Try again**; accept slow/fail props. Breathing stage and disabled composer stay. |
| `LeadRevealView` | Wire **None of these feel right** (today it is `aria-disabled`). |
| `CreativeStudio` | Add `feedback` sub-phase; start generation immediately; resume/retry when `generating_creative`. |

### Server actions

| Action | Behavior |
|---|---|
| `generateStudioCreative(campaignId)` | Persist `generating_creative`; call engine; validate; persist directions + v1 revisions + `creative_ready`. On failure, remain `generating_creative` with no directions. |
| `applyRefinement` | Unchanged signature. Engine behind it changes. |
| `regenerateStudioCreative(campaignId, feedback)` | Enforce cap; confirmation is client copy; then same persist path as generate with incremented `regenerationCount`. |

Restore, approve, and unapprove stay repository operations. They do not call the LLM.

### Prompt character (not a prompt library)

System prompts must inherit AI System non-negotiables:

- The customer describes; Modern Mail configures
- Optimize for the customer’s Primary Success Metric
- Ask or conflict rather than silently compromise intent
- Never identify as AI
- Never invent customer-specific facts
- Recommend with why; keep explanations to one to three sentences

Interview and Studio must feel like the same person.

---

## 9. Accessibility

Creative Studio PRD §9 and Creative Refinement PRD §11 still apply.

Additions:

| Event | Behavior |
|---|---|
| Generation start | Live region polite: “Creating your creative concepts.” |
| Generation complete | Live region polite: “Your concepts are ready. {leadDirectionName} is recommended.” |
| Generation failed | Live region assertive: failure copy. Focus **Try again**. |
| Feedback opens | Focus the feedback textarea |
| Regeneration cap | Live region polite: cap copy |
| Feedback cancel | Focus **None of these feel right** |

Reduced motion: unchanged. Generation breathing still collapses to static.

---

## 10. Edge cases

| Case | Behavior |
|---|---|
| No API key | Mock engine. Studio completable. Do not show a provider error. |
| `CREATIVE_ENGINE=mock` with a key present | Force mock (local/CI). |
| Provider timeout / 45s | Fail + Try again. Directions empty. |
| Invalid generation after retry | Fail + Try again. |
| Partial generation (< 3 directions) | Do not present. Treat as failure. |
| Empty refinement prompt | No-op (existing). |
| Refinement network failure | Inline error; spec unchanged; composer re-enabled. |
| Refresh mid-generation | Retry generate. |
| Refresh mid-refinement | Resume from persisted revisions (existing). |
| “Remove QR” on QR/appointment campaign | Conflict. Postcard unchanged. |
| Model drops required offer/phone/QR | Re-inject from brief. If the *request* was to remove them, conflict instead. |
| Model invents a phone/offer not in the brief | Reject those fields; do not persist invented facts. |
| Regeneration at cap | Cap copy; no engine call. |
| Approve as-is without refining | Unchanged — uses v1 spec. |
| Edit creative after approve | Unchanged — soft unapprove; no generation. |
| Existing campaigns with mock HVAC directions | Remain as persisted. Do not regenerate on read. |
| Logo described in prompt | Acknowledge; no file upload; do not fake a logo on the card. |

---

## 11. Beta scope — v0.4.0

### Ships

- `AnthropicCreativeEngine` behind `CreativeEngine`
- `MockCreativeEngine` fallback when no API key (or forced mock)
- AI-generated directions from the confirmed strategy brief
- AI-powered refinement with structured spec snapshots + studio-voice
- Deterministic `SpecDiff`, faithfulness re-injection, and conflict guard
- Regeneration (“None of these feel right”) with cap of 2
- Persisted `generating_creative` and `regenerationCount`
- Generation slow / fail / retry
- Existing Studio UX, history, approval, and audience handoff preserved

### Does not ship

- Logo file upload or storage
- Image generation or inpainting
- LLM-enriched or streamed generation narration
- Background job queue
- Real audience or fulfillment integrations
- New npm dependencies
- Automated test runner

### Non-goals

- Redesigning Studio
- Exposing models, prompts, or provider names to the customer
- Auto-approving or auto-launching creative
- Unlimited regenerations
- Treating mock HVAC sample data as production creative when a key is configured

---

## 12. Success criteria

v0.4.0 succeeds when:

1. A first-time customer with a **non-HVAC** brief (restaurant, dentist, or similar) sees three directions whose names, copy, offer, phone, metric, and rationale come from that brief — not ABC Air defaults.
2. Exactly one direction is recommended; the other two are strategically distinct.
3. An open-ended refinement the mock parser cannot handle updates the postcard, highlights changed regions, and appends history.
4. “Remove the QR” on a QR/appointment campaign shows conflict copy; the postcard does not change.
5. **None of these feel right** produces a new set that reflects the feedback; a third attempt shows cap copy.
6. Generation failure shows **Try again** and recovers.
7. With `ANTHROPIC_API_KEY` unset, the customer can still generate → refine → approve via mock.
8. Interview conversation still works (shared SDK/key, no regression).
9. Restore, approve, unapprove, and audience handoff still behave as in v0.3.0.
10. No customer-visible string identifies Modern Mail as AI or names a model.
11. Founder can complete the happy path (lead → approve as-is) in well under five minutes when the provider is healthy.

---

## 13. Implementation sequence (after this PRD is approved)

Do not begin production code until this document is approved.

1. **Phase 1 — Engine boundary.** `AnthropicCreativeEngine`, `MockCreativeEngine`, `getCreativeEngine()` selection, validators (constraints, faithfulness, conflict guard, banned-phrase filter). Stop calling mock helpers from actions.
2. **Phase 2 — Real generation.** Immediate `generateStudioCreative`; persist `generating_creative`; `GenerationView` slow/fail/retry.
3. **Phase 3 — Real refinement.** `applyRefinement` → engine; keep diffs/history/highlights; timeout copy.
4. **Phase 4 — Regeneration.** `feedback` sub-phase, `FeedbackComposer`, cap, confirmation line.
5. **Phase 5 — Harden and release.** Browser verification of §12, lint, build, milestone + checklist updates. Tag only when asked.

---

## Appendix — Version mapping

| Informal | Version | Status |
|---|---|---|
| Milestone 1 | v0.1.0 | ✅ Shipped |
| Milestone 2A | v0.2.0 | ✅ Shipped |
| Milestone 2B | v0.3.0 | ✅ Shipped |
| AI Creative Engine | **v0.4.0** | ← this document |

---

## Appendix — Document maintenance

Update this PRD when:

- Founder review changes engine behavior, fallback, or scope
- The Creative Studio or Creative Refinement PRD changes a contract this document relies on
- A later milestone adds image generation or logo upload (add a pointer; do not expand v0.4.0 silently)

Do not update this PRD for file-level implementation details once the engine is wired. Implementation conforms to this PRD.
