# Modern Mail — Release Milestones

This document formalizes the product roadmap as versioned milestones. Each milestone is independently shippable, maps to a semantic version tag, and should be completable without blocking on later work.

**Precedence:** Product Bible → UX Manifesto → AI System → Feature PRDs → this document.

---

## Version index

| Version | Name | Status | Scope summary |
|---|---|---|---|
| **v0.1.0** | Campaign Creator Foundation | ✅ Shipped | Status model, creative domain types, engine interfaces, Interview/Studio layout modes, progress indicator, stage ordering |
| **v0.2.0** | Creative Studio Foundation | ✅ Shipped | Generation narrative, mock directions, lead reveal, compare, focus, template previews — see note below |
| **v0.3.0** | Creative Refinement | ✅ Shipped | Refinement UX, revision history, highlighting, conflict handling, approval flow, mock engine, repository persistence |
| **v0.4.0** | AI Creative Engine | Planned | Anthropic-backed generation + refinement; swaps mock engine for real provider; mock fallback without API key |
| **v0.5.0** | Audience Selection | Planned | Post-creative audience confirmation, list upload, quantity handoff |
| **v0.6.0** | Data Provider Integration (Data Axle) | Planned | Real audience data, estimates, segmentation |
| **v0.7.0** | Production Partner Integration (Click2Mail) | Planned | Print/mail fulfillment pipeline |
| **v0.8.0** | Campaign Launch | Planned | Final review, pricing, payment, launch confirmation |
| **v0.9.0** | Command Center with Live Data | Planned | Replace mock snapshots with real campaign performance |
| **v1.0.0** | Private Beta | Planned | End-to-end beta-ready product for first customers |

---

## v0.1.0 — Campaign Creator Foundation ✅

**Question answered:** *Can the product support the correct customer journey structurally?*

### Ships
- Campaign status state machine (`draft` → `strategy_confirmed` → … → `launched`)
- Creative domain model (`CreativeDirection`, `CreativeRevision`, `CreativeSpec`, etc.)
- `CreativeEngine` provider interface (placeholder)
- Interview mode vs Studio mode layout
- Campaign progress indicator (Strategy → Creative → Audience → Quantity → Launch)
- Stage ordering: audience after `creative_approved`
- Strategy confirmation handoff into Studio

### Does not ship
- Creative UI, generation, refinement, AI

### PRD / docs
- Campaign Creator PRD (handoff order)
- Milestone 1 architecture review

---

## v0.2.0 — Creative Studio Foundation ✅

**Question answered:** *Does Modern Mail feel like an agency presenting work — not software loading data?*

### Ships
- Full Studio shell replacing placeholder
- Narrative-first generation (timed simulation, dev fast-mode)
- Three mock HVAC `CreativeDirection` objects
- Lead-first reveal, compare view, focus view
- Template-rendered `PostcardPreview`
- PRD motion: breathing stage, reveal choreography, hover states, reduced motion
- Repository persistence of creative directions (introduced with Studio initialization)

### Note on scope
The `v0.2.0` git tag also includes early Creative Refinement UI and mock engine work that was originally planned for v0.3.0. That code shipped ahead of the milestone split; **v0.3.0 finalization** (below) closes the remaining persistence, migration, accessibility, and documentation gaps.

### Does not ship (deferred to v0.3.0 finalization or later)
- `approvedSpec` snapshot persistence (v0.3.0 finalization)
- Legacy campaign read-time migration (v0.3.0 finalization)
- AI / Anthropic integration (v0.4.0)

### PRD / docs
- [`docs/prd/CreativeStudio.md`](prd/CreativeStudio.md)

### Follow-up polish (non-blocking)
- Deepen generation → reveal anticipation beat
- Evaluate larger postcard emphasis on lead reveal
- Envelope/rocket progress indicator (future UX milestone)

---

## v0.3.0 — Creative Refinement ✅

**Question answered:** *Can I shape this without learning design software — and am I confident enough to approve it?*

### Ships
- Refinement room (natural-language composer, no edit panels)
- Revision history with restore
- Structured spec diffs + region highlighting
- Conflict handling (mock rule engine)
- Approval interstitial + `creative_approved` status
- Persistent creative header post-approval
- Focus view CTAs: Start refining, Approve as-is
- Client + repository persistence of revisions, `approvedRevisionId`, and `approvedSpec`
- Legacy campaign migration on read (v1 revision backfill)
- Approval modal keyboard focus trap

### v0.3.0 finalization (this release)
- Persist `approvedSpec` at approval time
- Read-time migration for campaigns missing revision stacks
- Approval modal focus trap (Tab cycle, Escape → Keep refining)
- Roadmap / PRD reconciliation with actual ship history

### Does not ship
- Anthropic / LLM refinement (deferred to v0.4.0)
- Regeneration ("None of these feel right") (deferred to v0.4.0)
- Logo upload inline (deferred past v0.4.0)
- Image generation

### PRD / docs
- [`docs/prd/CreativeRefinement.md`](prd/CreativeRefinement.md)

---

## v0.4.0 — AI Creative Engine

**Question answered:** *Does the creative actually respond intelligently to my campaign and my words?*

### Ships
- `CreativeEngine` Anthropic implementation
- AI-generated directions from confirmed strategy brief
- AI-powered refinement with structured output (spec mutations + studio copy)
- Regeneration flow ("None of these feel right")
- Mock engine fallback when `ANTHROPIC_API_KEY` is not configured
- Generation slow / fail / retry; persist `generating_creative`

### Does not ship
- Real audience/fulfillment integrations
- Logo file upload (later milestone — leave existing UI disabled)
- Image generation
- LLM-enriched generation narration (deferred; keep brief templates)

### Founder decisions (2026-08-29)
- Logo upload is out of scope for v0.4.0
- Keep mock fallback when no API key is configured

### PRD / docs
- [`docs/prd/AICreativeEngine.md`](prd/AICreativeEngine.md)

---

## v0.5.0 — Audience Selection

**Question answered:** *Who will receive what I approved?*

### Ships
- Narrative-first audience stage post-approval
- Audience estimate (mock or rule-based until v0.6.0)
- Quantity confirmation (decoupled from audience fields)
- Tracking method tied to Primary Success Metric

---

## v0.6.0 — Data Provider Integration (Data Axle)

**Question answered:** *Can Modern Mail find the right households for my campaign?*

### Ships
- Data Axle (or equivalent) audience provider integration
- Real reachable counts, geography, attribute summaries

---

## v0.7.0 — Production Partner Integration (Click2Mail)

**Question answered:** *Will this actually be printed and mailed?*

### Ships
- Click2Mail (or equivalent) submission pipeline
- Mail status lifecycle on campaign

---

## v0.8.0 — Campaign Launch

**Question answered:** *Am I ready to commit and send?*

### Ships
- Final review screen (creative + audience + quantity + cost)
- Payment integration (or beta equivalent)
- Launch confirmation, `launched` status

---

## v0.9.0 — Command Center with Live Data

**Question answered:** *How's my mail doing?*

### Ships
- Command Center wired to real campaigns
- Campaign Confidence from real metrics (or simulated progression)
- Remove dev state switcher

---

## v1.0.0 — Private Beta

**Question answered:** *Can a real customer complete the full journey successfully?*

### Ships
- End-to-end: create → refine → approve → audience → launch → measure
- Beta polish pass, error recovery, campaign list/resume
- Auth (minimum viable)

### Beta success criteria
- First-time customer launches in under five minutes (happy path)
- Customers describe experience as "having a designer"
- See Product Bible success metrics

---

## Tagging convention

When a milestone is complete:

```bash
git tag -a v0.3.0 -m "Creative Refinement — refinement, history, approval"
git push origin v0.3.0
```

Milestone PRs should reference the target version in title and description.

---

## Document maintenance

Update this file when:
- A milestone ships (mark ✅, add ship date in commit/tag message)
- Scope changes during founder review
- New milestones are inserted

Do not use informal "Milestone 2B" labels in PR titles without mapping to a version here.
