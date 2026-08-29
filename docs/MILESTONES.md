# Modern Mail — Release Milestones

This document formalizes the product roadmap as versioned milestones. Each milestone is independently shippable, maps to a semantic version tag, and should be completable without blocking on later work.

**Precedence:** Product Bible → UX Manifesto → AI System → Feature PRDs → this document.

---

## Version index

| Version | Name | Status | Scope summary |
|---|---|---|---|
| **v0.1.0** | Campaign Creator Foundation | ✅ Shipped | Status model, creative domain types, engine interfaces, Interview/Studio layout modes, progress indicator, stage ordering |
| **v0.2.0** | Creative Studio Foundation | ✅ Shipped | Generation narrative, mock directions, lead reveal, compare, focus — presentation shell, no AI |
| **v0.3.0** | Creative Refinement | 🔜 Next | Refinement UX, revision history, change highlighting, conflict handling, approval flow, mock refinement engine |
| **v0.4.0** | AI Creative Engine | Planned | Anthropic-backed generation + refinement; swaps mock engine for real provider |
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

### Does not ship
- Refinement, revision history, approval
- Repository persistence of creative state
- AI / Anthropic integration

### PRD / docs
- [`docs/prd/CreativeStudio.md`](prd/CreativeStudio.md)

### Follow-up polish (non-blocking)
- Deepen generation → reveal anticipation beat
- Evaluate larger postcard emphasis on lead reveal
- Envelope/rocket progress indicator (future UX milestone)

---

## v0.3.0 — Creative Refinement 🔜

**Question answered:** *Can I shape this without learning design software — and am I confident enough to approve it?*

### Ships
- Refinement room (natural-language composer, no edit panels)
- Revision history with restore
- Structured spec diffs + region highlighting
- Conflict handling (mock rule engine)
- Approval interstitial + `creative_approved` status
- Persistent creative header post-approval
- Focus view CTAs: Start refining, Approve as-is
- Client + repository persistence of revisions and approved spec

### Does not ship
- Anthropic / LLM refinement (deferred to v0.4.0)
- Audience stage activation (requires v0.5.0 polish; header may preview handoff)
- Image generation, logo upload

### PRD / docs
- [`docs/prd/CreativeRefinement.md`](prd/CreativeRefinement.md) *(design review — pending approval)*

---

## v0.4.0 — AI Creative Engine

**Question answered:** *Does the creative actually respond intelligently to my campaign and my words?*

### Ships
- `CreativeEngine` Anthropic implementation
- AI-generated directions from confirmed strategy brief
- AI-powered refinement with structured output (spec mutations + studio copy)
- Regeneration flow ("None of these feel right")
- Generation narration optionally LLM-enriched

### Does not ship
- Real audience/fulfillment integrations

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
