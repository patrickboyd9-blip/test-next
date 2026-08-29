# Creative Refinement & Approval — Design Review

## Document status

**Product design specification for v0.3.0 (Creative Refinement).**

| Precedence | Document |
|---|---|
| 1 | Product Bible |
| 2 | UX Manifesto |
| 3 | AI System |
| 4 | Campaign Creator |
| 5 | Creative Studio PRD |
| 6 | **This document** |

**Companion release doc:** [`docs/MILESTONES.md`](../MILESTONES.md)

**Scope:** Milestone 2B / **v0.3.0** — refinement UX, revision history, change highlighting, conflict handling, approval flow, undo/restore. Mock refinement engine only. **No Anthropic integration** (deferred to v0.4.0).

**Out of scope for v0.3.0:** Audience activation, AI generation, logo upload, payment, Command Center.

---

## 1. Purpose

### Questions this milestone answers

| Phase | Question |
|---|---|
| Refinement | *Can I shape this without learning design software?* |
| Revision history | *Can I experiment safely?* |
| Approval | *Am I confident enough to put my name on this?* |

### Why v0.3.0 exists separately from v0.2.0

v0.2.0 proved Modern Mail **presents** creative work like an agency. v0.3.0 proves the customer **owns** it — through language, history, and explicit approval.

Without refinement and approval, Studio is a gallery. With them, Studio is a collaboration.

### Relationship to v0.4.0 (AI Creative Engine)

v0.3.0 ships a **mock refinement engine** that applies deterministic spec mutations from parsed customer prompts. This is intentional:

1. UX, motion, history, and conflict paths can be perfected without model variance.
2. **Structured revision diffs** are captured on every change — v0.4.0 swaps the mutation logic for LLM output without changing the customer-facing experience.
3. AI System constitution applies to copy templates immediately; model-generated copy plugs in later.

---

## 2. Entry and exit

### Entry points

| From | Action | Lands in |
|---|---|---|
| Lead reveal | **Continue with this →** | Focus → optional **Start refining →** |
| Compare | Select card | Focus |
| Focus | **Start refining →** | Refinement room |
| Focus | **Approve as-is** | Approval interstitial (skip refinement — valid happy path) |
| Refinement | **Approve creative →** | Approval interstitial |

### Exit

| Action | Result |
|---|---|
| **Approve creative** (interstitial) | `creative_approved`, persistent header, Studio UI collapses to header + audience placeholder message |
| **Keep refining** (interstitial) | Return to refinement room, no state loss |

### What changes in Focus view (v0.3.0 delta from v0.2.0)

v0.2.0 Focus is view-only. v0.3.0 adds:

- Primary CTA: **Start refining →**
- Secondary CTA: **Approve as-is**
- Sticky footer is **not** shown in Focus — only in Refinement

CTA hierarchy in Focus:

1. **Start refining →** (primary — most customers iterate at least once)
2. **Approve as-is** (secondary outline — respects happy path)
3. **Compare** (link, top-right — unchanged)
4. **Switch direction** strip (unchanged)

---

## 3. Refinement UX

### Primary question

> *Can I shape this without learning design software?*

### Layout — Refinement room (Screen E, Creative Studio PRD)

**Desktop (≥768px):**

```
┌─────────────────────────────────────────────────────────────┐
│  Refining: {directionName}                    v{n} current  │
├──────────────────────────────┬──────────────────────────────┤
│                              │  Revision history            │
│   [ POSTCARD HERO 62% ]      │  v3 · just now    [Current]  │
│   shimmer / highlight        │  v2 · 2 min ago              │
│                              │  v1 · original concept       │
├──────────────────────────────┴──────────────────────────────┤
│  What would you like to change?                             │
│  [ composer — enabled ]                                       │
│  [ suggestion chips ]                                         │
│  [ studio-voice response ]                                    │
├─────────────────────────────────────────────────────────────┤
│  STICKY FOOTER: Compare directions  |  Approve creative →  │
└─────────────────────────────────────────────────────────────┘
```

**Mobile:** Stack — hero → history (max-h 160px scroll) → composer → sticky footer.

### Composer behavior

| Rule | Specification |
|---|---|
| Label | **What would you like to change?** |
| Submit | **Apply change** button + Enter (Shift+Enter = newline) |
| Disabled state | While applying — show "Applying your change…" inline |
| Placeholder rotation | Every 5s when idle; contextual per brief (PRD §5.5) |
| Suggestion chips | Tap fills composer; customer may edit before submit |
| Max length | 500 characters (soft — no harsh error, truncate warn at 480) |

**Non-negotiable:** No font pickers, color wheels, layers, or drag handles. Natural language only.

### Refinement interaction loop

```
Customer submits prompt
        ↓
Composer disabled · shimmer on postcard (600ms)
        ↓
Mock engine evaluates prompt + brief + current spec
        ↓
    ┌─── conflict? ───┐
    │ yes             │ no
    ↓                 ↓
Spec unchanged    New spec snapshot
Conflict copy     Compute changedRegions + specDiff
    │                 │
    └────────┬────────┘
             ↓
Studio-voice line fades in below composer
Revision entry appended (if success or restore)
Changed regions highlight on postcard (1.5s)
Composer cleared and re-enabled
```

### Mock refinement engine (v0.3.0)

Rule-based parser — not LLM. Handles PRD example prompts reliably:

| Prompt pattern | Spec mutation | changedRegions |
|---|---|---|
| "bigger/larger headline" | Increase headline visual weight (tag + optional subheadline adjust) | `["headline"]` |
| "warmer colors/tone" | Shift palette toward warm hex set | `["palette"]` |
| "move phone … bottom right" | Reposition phone in layout metadata | `["phone", "layoutHints"]` |
| "prominent/bigger QR" | Enlarge QR treatment flag | `["callToAction", "layoutHints"]` |
| "green/red border" | Accent color shift | `["palette"]` |
| "make headline {text}" | Set headline literal | `["headline"]` |
| Ambiguous "make it better" | No mutation — conflict: clarifying question | — |
| "remove QR" when metric is QR | No mutation — conflict | — |

**Implementation note:** Add optional `layoutHints` on `CreativeSpec` for positional semantics the template respects — not customer-visible.

Unrecognized prompts return a helpful studio-voice line: *"I can adjust the headline, colors, phone placement, or QR prominence. What would you like to change?"* — not an error wall.

### Per-direction revision stacks

Each `CreativeDirection` maintains its own `revisions[]`. Switching direction in Focus/Compare loads that direction's stack. Switching during refinement via footer **Compare directions** returns to compare/focus — refinement state on current direction is preserved.

---

## 4. Structured revision diffs (v0.3.0 requirement)

Every successful refinement, restore, or conflict attempt that receives a prompt must capture:

```typescript
interface SpecDiff {
  /** Spec keys whose values changed (for highlight + AI). */
  changedRegions: string[]
  /** Human-readable before/after pairs for studio copy and v0.4.0 AI. */
  changes: Array<{
    field: string
    before: string
    after: string
    label: string  // e.g. "Headline", "Primary color"
  }>
}
```

**Why both `changedRegions` and `changes`:**
- `changedRegions` drives postcard highlight overlays (machine).
- `changes` drives studio-voice copy in v0.3.0 without an LLM: *"Done — headline is larger and your phone number is now bottom-right."*
- v0.4.0 passes `changes` to the model for natural phrasing while preserving factual accuracy.

**Revision record (extends Creative Studio PRD §6.5):**

| Field | v0.3.0 |
|---|---|
| `spec` | Full snapshot after this revision |
| `specDiff` | Structured diff from previous version |
| `customerPrompt` | Verbatim input |
| `studioResponse` | Confirmation or conflict message |
| `type` | `refinement` \| `restore` \| `conflict` |
| `version` | Sequential per direction |

`conflict` revisions are logged but do **not** increment the visual version number on the postcard — they appear in history as gray entries: *"Request not applied — QR kept for appointment tracking"* (truncated prompt).

---

## 5. Revision history

### Primary question

> *Can I experiment safely?*

### Panel specification

| Element | Spec |
|---|---|
| Header | **Revision history** + version badge **v{n}** aligned right in page header |
| Order | Newest first |
| Entry | `v{n} · {relative time}` + truncated prompt (60 chars) |
| v1 | Always **v1 · original concept** — prompt label fixed |
| Current | **Current** badge on active version |
| Conflict entries | Muted style, no version bump, icon optional (dash circle) |
| Restore | Tap any entry → crossfade postcard → new revision with `type: restore` |

### Restore semantics (PRD-aligned, non-destructive)

1. Customer taps v2 in history.
2. Postcard crossfades to v2 spec (300ms).
3. New revision v4 created: `customerPrompt: "Restored v2"`, `type: restore`, `spec` = copy of v2.
4. Studio-voice: *"Restored v2 — your design from 2 minutes ago."*
5. History never deletes entries.

**Undo = restore.** No separate undo stack.

### Scroll behavior

Desktop: panel scrolls independently if entries exceed postcard height.
Mobile: max-height 160px, scroll within panel.

---

## 6. Change highlighting

### Purpose

Customer sees **what moved** without a diff tool — answers before evidence (UX Manifesto §2).

### Region map (template-aware)

| changedRegions key | Highlight overlay on postcard |
|---|---|
| `headline` | Top third band |
| `body` | Center content band |
| `callToAction` | CTA button area |
| `offer` | Offer block |
| `phone` | Footer contact zone |
| `palette` | Full-bleed subtle tint overlay (lower opacity) |
| `layoutHints` | Affected corner/edge per hint |

### Motion (PRD §4)

| Step | Behavior |
|---|---|
| On apply success | 600ms shimmer sweep (full card) |
| Then | 1500ms border pulse on affected region(s) only, primary @ 40% opacity |
| Reduced motion | Shimmer → opacity 0.7→1.0 (300ms); highlight → static border 1s |

Highlight clears automatically — no dismiss required.

---

## 7. Conflict handling

### When to conflict (AI System + Creative Studio PRD)

Block mutation when the request would:

1. Remove or hide **Primary Success Metric** path (QR when metric is appointments via QR, phone when metric is phone calls).
2. Remove required brief elements (offer when offer-led campaign, required phone/website).
3. Contradict stated goal without customer explicitly changing strategy.

### Do not block

- Style preference changes that preserve required elements.
- Ambiguity — ask one clarifying question instead of blocking silently.
- Impossible layout requests — apply best-effort or explain limitation in studio voice.

### Conflict UX

| Element | Behavior |
|---|---|
| Postcard | **Does not change** |
| Shimmer | **Does not run** (or 200ms subtle "no change" pulse — prefer skip) |
| Studio-voice | Assertive live region — conflict template (PRD §5.6) |
| Composer | Stays enabled, prompt preserved for edit |
| History | Log `type: conflict` entry (muted) |

### Conflict copy templates (fixed — v0.3.0)

Use PRD §5.6 verbatim patterns keyed by conflict type. Example:

> I'd recommend keeping the QR code — appointment bookings is your primary success metric, and the QR is the fastest path there. I can make it smaller or move it if it's competing visually. What would you prefer?

### Clarifying question (ambiguous prompt)

> Better how — bolder, warmer, or more focused on the offer?

Single question. Not a form.

---

## 8. Approval flow

### Primary question

> *Am I confident enough to put my name on this?*

### Approval interstitial (Screen F)

Modal overlay within Studio — **not a route change**.

| Element | Content |
|---|---|
| Preview | Postcard medium (280px), front default |
| Headline | **Ready to approve this design?** |
| Body | *This is what we'll print and mail. You can still make changes until you confirm your audience.* |
| Metric | *Designed to drive: {metric} via {destination}* |
| Primary | **Approve creative** |
| Secondary | **Keep refining** |

### On approve

1. Persist `creative_approved`, `approvedRevisionId`, `approvedSpec` on campaign (repository — **required in v0.3.0**).
2. Modal settle animation + checkmark on thumbnail.
3. Progress: Creative → complete.
4. **PersistentCreativeHeader** sticky (64px) — thumbnail, direction name, **Creative approved ✓**, **Edit creative**.
5. Studio body hides generation/compare/refinement; handoff line once.
6. Audience stage remains gated until v0.5.0 full implementation — show read-only preview line: *"Audience confirmation comes next"* or enable existing `AudienceStage` if founder approves early activation.

**Decision for v0.3.0:** Enable existing `AudienceStage` below header when `creative_approved` — architecture already supports it. v0.5.0 polishes narrative-first audience UX.

### Reversibility — Edit creative

From persistent header:

1. Tap **Edit creative**.
2. Confirm modal: *You can still refine this design. You'll need to approve it again before launching.*
3. Status → `creative_ready` (soft unapprove). Clear `approvedRevisionId` only; revisions preserved.
4. Return to refinement room on current spec.

---

## 9. Undo / restore behavior

| Customer intent | Mechanism |
|---|---|
| Undo last change | Restore previous revision from history |
| Go back to original | Restore v1 |
| "I liked it better before" | Tap any prior version |

No Cmd+Z in v0.3.0 — history panel is the undo system. Keyboard shortcut is v1.1+ polish.

Restore always creates a forward revision — audit trail intact.

---

## 10. Motion design (v0.3.0 additions)

| Transition | Spec |
|---|---|
| Focus → Refinement | Crossfade content, 200ms; composer fades in 150ms delay |
| Apply refinement | Shimmer 600ms linear → highlight 1500ms |
| History new entry | Slide from top, 200ms |
| Restore | Postcard crossfade 300ms |
| Approval modal open | Backdrop fade 200ms; modal scale 0.96→1 spring |
| Approval confirm | Settle + badge; modal out 200ms; header slide down 250ms |
| Reduced motion | All above collapse to 150ms opacity-only |

### v0.2.0 polish carryover (approved notes)

Apply to **generation → lead reveal** in same release if low cost:

- Add 150ms beat between narrative fade-out and postcard entrance (anticipation).
- Optional: lead reveal postcard width +8% on desktop (456px max) — **evaluate in implementation**; default to PRD 420px unless side-by-side feels stronger.

**Envelope/rocket progress indicator:** Remains on UX roadmap — **not v0.3.0**.

---

## 11. Accessibility

### Keyboard

| Context | Keys |
|---|---|
| Refinement composer | Enter submit, Shift+Enter newline |
| Suggestion chips | Tab + Enter |
| History entries | Tab + Enter to restore |
| Approval modal | Focus trap; Escape → Keep refining |
| Footer | Tab order: Compare → Approve |

### Focus management

| Event | Focus |
|---|---|
| Enter refinement | Composer textarea |
| After apply success | Composer (cleared) |
| Conflict | Composer (prompt preserved) |
| Open approval | **Approve creative** |
| Close approval (Keep refining) | Composer |
| Approve success | First focusable in audience section or header |

### Screen reader

| Event | Live region |
|---|---|
| Apply success | Polite: `{studioResponse}` |
| Conflict | Assertive: `{conflictMessage}` |
| Restore | Polite: "Restored v{n}" |
| Approved | Polite: "Creative approved" |
| Postcard | `aria-label` includes headline text |

### Reduced motion

All refinement animations respect `prefers-reduced-motion` per PRD §4.

---

## 12. State machine (v0.3.0 delta)

### Persisted campaign status

| Status | When |
|---|---|
| `creative_ready` | Generation complete; refinement in progress; unapproved |
| `creative_approved` | Customer approved |

`generating_creative` remains transient (client + optional future server job in v0.4.0).

### UI sub-phases (client, within `creative_ready`)

```
lead | compare | focus | refine | approval
```

New in v0.3.0: `refine`, `approval`.

### Repository changes (minimal — required)

v0.3.0 **does** persist creative state:

| Field | Purpose |
|---|---|
| `creative.revisions[]` | Per-direction revision stacks |
| `creative.selectedDirectionId` | Active direction |
| `creative.approvedRevisionId` | Approval pointer |
| `creative.activeSpec` | Current rendered spec (or derive from latest revision) |
| `status` transitions | `creative_approved` on approve |

Server actions:

- `applyRefinement(campaignId, prompt)` — mock engine
- `restoreRevision(campaignId, revisionId)`
- `approveCreative(campaignId)`
- `unapproveCreative(campaignId)` — Edit creative

---

## 13. Component inventory (v0.3.0 delta)

| Component | Responsibility |
|---|---|
| `RefinementView` | Two-column layout, composer, footer |
| `RevisionHistoryPanel` | List, restore, conflict styling |
| `StudioComposer` | Enabled composer + chips (replaces shell) |
| `ApprovalModal` | Focus-trapped interstitial |
| `PersistentCreativeHeader` | Post-approval sticky bar |
| `PostcardPreview` | + `highlightRegions`, `isShimmering` props |
| `SpecDiffHighlight` | Overlay regions on template |
| `MockRefinementEngine` | `lib/campaign-creator/mock-refinement-engine.ts` |
| `buildStudioResponse(specDiff)` | Template copy from structured diff |

Update `FocusView` with Start refining / Approve as-is CTAs.

Update `CreativeStudio` orchestrator for new sub-phases.

---

## 14. Edge cases

| Case | Behavior |
|---|---|
| Submit empty prompt | Disable submit; no-op |
| Submit while applying | Queue disabled — ignore second submit |
| Rapid double Enter | Debounce 300ms after apply |
| Switch direction mid-refinement | Prompt save dialog **not** required — each direction has own stack; switch via Compare |
| Approve as-is from Focus without refining | Approval uses direction's v1 spec |
| Approve after 10 refinements | Allowed — no cap on refinements (regeneration cap is separate, v0.4.0) |
| Restore then refine | New branch forward — expected |
| Refresh mid-refinement | Resume from persisted revisions |
| Network failure on apply | Inline error; spec unchanged; retry |
| Edit creative after approve | Soft unapprove flow |
| Customer on mobile landscape | Sticky footer must not cover composer — pad bottom |

---

## 15. Beta scope — v0.3.0

### Ships

- Refinement room with mock engine
- Structured `SpecDiff` on every mutation attempt
- Revision history + restore
- Region highlighting
- Conflict handling (QR, phone, offer, ambiguous)
- Approval interstitial + persistent header
- Focus CTAs (Start refining, Approve as-is)
- Repository persistence for revisions and approval
- Audience stage visible post-approval (existing component, narrative polish deferred to v0.5.0)

### Deferred to v0.4.0

- Anthropic refinement + generation
- LLM studio-voice (templates suffice in v0.3.0)
- Regeneration ("None of these feel right")
- Logo upload on "Add my logo" chip

### Non-goals

- Edit panels, canvas, pixels
- Auto-approve
- Separate undo keyboard shortcut

---

## 16. Success criteria

v0.3.0 succeeds when:

1. Customer refines via natural language and sees the postcard change with highlighted regions.
2. Customer restores v1 without losing history.
3. Conflict on "remove QR" shows explanation, not silent failure.
4. Customer approves explicitly; persistent header confirms approval.
5. Founder can read `specDiff.changes` in dev tools and understand exactly what changed — ready for v0.4.0 AI copy.

---

## 17. Implementation sequence (post-approval)

1. Extend types: `SpecDiff`, revision fields, `layoutHints`
2. Mock refinement engine + diff builder
3. Repository actions + persistence
4. `RefinementView`, `RevisionHistoryPanel`, `StudioComposer`
5. Postcard highlight + shimmer
6. `ApprovalModal`, `PersistentCreativeHeader`
7. Wire Focus CTAs + orchestrator
8. Enable audience below header on approve

**Do not begin until this document is approved.**

---

## Appendix — Version mapping

| Informal | Version |
|---|---|
| Milestone 1 | v0.1.0 ✅ |
| Milestone 2A | v0.2.0 ✅ |
| Milestone 2B | **v0.3.0** ← this document |
| AI Creative Engine | v0.4.0 |
