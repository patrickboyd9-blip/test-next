# Creative Studio PRD

## Document status

**Canonical product specification** for the Creative Studio feature in Modern Mail.

| Precedence | Document |
|---|---|
| 1 | Product Bible |
| 2 | UX Manifesto |
| 3 | AI System |
| 4 | Campaign Creator |
| 5 | **This PRD** |

When this PRD is silent, defer to the documents above. When this PRD specifies behavior, engineering and design must implement it as written — not as a starting point for further UX invention.

This is not an architecture document. It does not specify APIs, models, or file structure. It specifies what the customer experiences and what the product must do.

---

## 1. Purpose

### The question Creative Studio answers

> **"What should my mailer look like — and will it work?"**

Creative Studio is where a customer's campaign idea becomes a physical artifact they are proud to send. It answers whether Modern Mail understood their business, their goal, and their definition of success — by showing them professional creative work, not by asking them to configure a design tool.

Secondary questions answered within the Studio:

| Phase | Question |
|---|---|
| Generation | *Is Modern Mail working on something for me?* |
| Lead reveal | *Do they understand my business?* |
| Compare | *Do I have real choices?* |
| Select | *Which direction is mine?* |
| Refine | *Can I shape this without learning software?* |
| Approval | *Am I confident enough to put my name on this?* |
| Handoff | *What happens next?* |

### Why it exists

Campaign creation interviews collect strategy. Creative Studio **produces the deliverable**. Without Studio, Modern Mail is a form with AI chat. With Studio, Modern Mail is an agency that executes.

Studio exists because:

1. **Physical outreach is visual.** Customers must see the mailer before they commit recipients, quantity, or spend.
2. **Trust requires evidence.** Strategy summaries build intellectual confidence. Creative previews build emotional confidence.
3. **The Product Bible promises iterative creative control without a design tool.** Studio is where that promise is kept.
4. **Success is outcome-driven.** Every concept must visibly serve the customer's Primary Success Metric — not generic "beautiful design."

### Why this is the emotional centerpiece

Modern Mail's north star is: *"I can't imagine managing physical outreach any other way."* That sentence is won or lost in Creative Studio.

- The **interview** proves Modern Mail listens.
- The **Studio** proves Modern Mail delivers.
- Everything after Studio (audience, launch, measurement) proves Modern Mail completes the loop.

If Studio feels like ChatGPT with pictures, the product fails. If Studio feels like hiring an award-winning creative agency, the product wins.

**Emotional target:** The customer should feel surprise, recognition, agency, pride, and momentum — in that order — before they reach audience selection.

---

## 2. User Journey

Creative Studio begins when the customer confirms their strategy and ends when they approve creative and enter audience selection. Studio occupies campaign statuses `strategy_confirmed` through `creative_approved`.

### Phase 0 — Strategy Approved (entry)

**Trigger:** Customer taps **Confirm strategy** on the Strategy Summary in Interview mode.

**What happens:**
- Campaign status → `strategy_confirmed`.
- Layout transitions from Interview mode (narrow, `max-w-2xl`) to Studio mode (wide, `max-w-5xl`).
- Progress indicator: Strategy → complete. Creative → active.
- Conversation collapses into **View conversation**.
- Studio immediately begins generation — customer does not tap a second "Generate" button.

**Customer sees:** Brief transition animation, then the Generation screen.

**Customer does not see:** A blank placeholder, a configuration form, or a "Generate concepts" button.

---

### Phase 1 — Studio Opens / Generation

**Trigger:** Automatic on entry to `strategy_confirmed`. Status immediately advances to `generating_creative`.

**Primary question:** *Is Modern Mail working on something for me?*

**Customer sees:**
- Empty stage with breathing ambient animation.
- Narrative progress lines updating every 2.5 seconds (see Section 5).
- Disabled refinement composer with future placeholder text.
- Progress indicator: Creative → active.

**Duration:** Target 15–30 seconds. Slow state at 15 seconds. Failed state at 45 seconds.

**Exit:** Status → `creative_ready`. Lead concept reveal begins automatically.

---

### Phase 2 — Lead Concept Reveal

**Trigger:** Generation completes. Status is `creative_ready`. UI defaults to **lead-first presentation** — not a three-up grid.

**Primary question:** *Do they understand my business?*

**Customer sees:**
- One postcard preview at hero scale (front visible; back accessible via toggle).
- **★ Our recommendation** label.
- Direction name (2–4 words).
- "Why this works" — two sentences.
- "Designed to drive:" — Primary Success Metric in customer language.
- Three strategy tags.
- Primary CTA: **Continue with this →**
- Secondary CTA: **See 2 other directions**
- Tertiary text link: **None of these feel right**

**Default behavior:** Customer is never shown three equal options on first paint. Modern Mail presents its recommendation first — the way a creative director presents work.

---

### Phase 3 — Compare Concepts

**Trigger:** Customer taps **See 2 other directions**.

**Primary question:** *Do I have real choices?*

**Customer sees:**
- Three concept cards in a horizontal row (desktop) or vertical stack (mobile).
- Lead concept retains **Recommended** badge and is visually first.
- Each card: thumbnail preview, direction name, one-line strategic difference.
- Tap any card → Focus view for that concept.

**Customer does not see:** Side-by-side pixel comparison mode, diff overlays, or "pick the best looking one" framing without strategic context.

**Exit paths:**
- Tap a concept → Select / Focus (Phase 4).
- Tap outside or **Back to recommendation** → Lead Concept Reveal.

---

### Phase 4 — Select Concept

**Trigger:** Customer taps **Continue with this** (from lead reveal) or selects a card (from compare).

**Primary question:** *Which direction is mine?*

**Customer sees:**
- Selected concept at hero scale.
- Full rationale block.
- Strategy tags.
- Primary CTA: **Start refining →**
- Secondary CTA: **Approve as-is** (skip refinement — valid happy path).
- Bottom strip: thumbnails of the other two directions with label **Switch direction**.
- One studio-voice caption (see Section 5) — appears once, does not persist as a chat thread.

**On select:** `selectedDirectionId` is set. Other directions remain accessible but refinements attach only to the selected direction.

**Exit:** **Start refining →** enters Refinement. **Approve as-is** enters Approval (Phase 7).

---

### Phase 5 — Refine

**Trigger:** Customer taps **Start refining →**.

**Primary question:** *Can I shape this without learning software?*

**Customer sees:**
- Split layout (desktop): postcard hero left (~62%), revision history right (~38%).
- Stacked layout (mobile): postcard hero, then history, then composer.
- Enabled natural-language composer with contextual suggestion chips.
- **Approve creative →** always visible in sticky footer.
- **Compare directions** escape hatch in footer.

**Interaction loop:**
1. Customer describes a change.
2. Customer submits (Enter or **Apply change** button — both equivalent).
3. Shimmer sweep on postcard (600ms).
4. Postcard re-renders.
5. Changed region highlights (1.5s pulse).
6. Studio-voice confirmation inline below composer.
7. New revision appended to history.

**Conflict path:** If change undermines Primary Success Metric or required elements, postcard does not change. Studio-voice conflict message appears with alternative suggestion.

**Exit:** **Approve creative →** enters Approval. **Compare directions** returns to Focus view without losing revision history on current direction.

---

### Phase 6 — Revision History

**Concurrent with Refinement** — not a separate phase.

**Customer sees:**
- Header: **Revision history**
- List ordered newest-first.
- Each entry: version label (`v3 · just now`), truncated customer prompt (max 60 characters).
- **v1 · original concept** always present and always restorable.
- Active version indicated with subtle **Current** badge.

**Restore behavior:** Tap any prior version → crossfade to that spec → studio-voice line: *"Restored v1 — your original concept."* Restoration creates a new revision entry (`Restored v1`) — history is never destructive.

---

### Phase 7 — Approval

**Trigger:** Customer taps **Approve creative →** (from Refinement or Focus view via **Approve as-is**).

**Primary question:** *Am I confident enough to put my name on this?*

**Customer sees:** Approval interstitial — full-screen overlay within Studio (not a new route).

- Final postcard preview at medium scale.
- Headline: **Ready to approve this design?**
- Reversibility copy (see Section 5).
- Primary CTA: **Approve creative**
- Secondary CTA: **Keep refining**

**On approve:**
- Status → `creative_approved`.
- Checkmark badge animates onto postcard.
- Progress: Creative → complete. Audience → active.
- Persistent creative preview enters campaign header (see Layout).
- Studio-voice handoff line appears once.

**Reversibility:** Until audience is confirmed, customer may return to refinement from the persistent preview menu (**Edit creative**). Status returns to `creative_ready` with refinements preserved. Re-approval required.

---

### Phase 8 — Audience Handoff

**Trigger:** Creative approved. Audience stage renders below persistent creative header.

**Primary question:** *Who will receive what I just approved?*

**Customer sees:**
- Persistent approved creative thumbnail + direction name in sticky header.
- Audience stage (owned by Campaign Creator PRD) below.
- One studio-voice bridge line (see Section 5).

**Customer does not see:** Studio generation UI, concept comparison, or refinement composer. Those are complete.

**Emotional beat:** Momentum — *"Let's get this out."* Not a new workflow.

---

## 3. Pixel-Level Layout

### Global Studio chrome

Applies to all Studio phases (`strategy_confirmed` through `creative_approved` and during audience handoff while creative header persists).

| Element | Specification |
|---|---|
| **Max content width** | `896px` (`max-w-5xl`) centered |
| **Horizontal padding** | `24px` mobile, `32px` tablet+ |
| **Vertical gap between sections** | `24px` (`gap-6`) |
| **Background** | Default app background — no distinct Studio background color in beta |
| **Progress indicator** | Top of Studio content, full width of content column, `32px` margin below |

### Sticky elements

| Element | Sticky behavior |
|---|---|
| **Progress indicator** | Not sticky — scrolls away |
| **Persistent creative header** | Sticky top after approval only (`creative_approved`+). Height `64px`. Border-bottom `1px` border color. Background `bg-background/95` with backdrop blur |
| **Refinement footer** | Sticky bottom during Refinement phase. Contains **Approve creative →** and **Compare directions**. Height auto, min `72px`. Top border `1px`. Background `bg-background/95` backdrop blur |
| **Collapsed conversation** | Not sticky — scrolls with content |

### Persistent creative preview (post-approval)

| Property | Value |
|---|---|
| **Height** | `64px` sticky header |
| **Thumbnail** | Postcard front, `40px × 28px` (4×6 ratio), rounded `4px`, shadow-sm |
| **Direction name** | `text-sm font-medium`, truncated single line |
| **Status** | `Creative approved ✓` in `text-xs text-muted-foreground` |
| **Action** | **Edit creative** text button, right-aligned |

---

### Screen A — Generation

**Hierarchy (top → bottom):**

1. Progress indicator
2. Collapsed conversation
3. Stage area (flex-1, min-height `360px` desktop / `280px` mobile)
4. Narrative panel (centered, max-width `480px`)
5. Disabled composer

**Stage area:**
- Centered in content column.
- Faint postcard outline silhouette (stroke only, `opacity 0.12`) centered, `240px` wide desktop / `180px` mobile.
- Breathing gradient behind silhouette: radial, primary at `8%` opacity, pulsing `0.6` ↔ `1.0` opacity over 3s.

**Narrative panel:**
- `text-sm text-muted-foreground`, centered.
- Single line visible at a time.
- `24px` below stage area.

**Disabled composer:**
- Same visual as active composer but `opacity 0.5`, pointer-events none.
- Placeholder: *"You'll refine your favorite here once concepts are ready."*

**CTA hierarchy:** None active. Customer waits.

---

### Screen B — Lead Concept Reveal

**Hierarchy:**

1. Progress indicator
2. Collapsed conversation
3. Section label: **Your concepts are ready** — `text-lg font-semibold`
4. Postcard preview (hero)
5. Recommendation block
6. CTA group
7. Tertiary link

**Postcard preview (hero):**

| Property | Desktop | Tablet | Mobile |
|---|---|---|---|
| Width | `420px` | `360px` | `100%` max `320px` |
| Aspect ratio | 3:2 (4×6 postcard) | 3:2 | 3:2 |
| Shadow | `shadow-lg` | same | `shadow-md` |
| Border radius | `8px` | same | same |
| 3D hover | `rotateY(2deg)` subtle | disabled on touch | disabled |

**Front/back toggle:**
- Segmented control directly below preview: **Front | Back**
- Default: Front
- `8px` gap below preview

**Recommendation block — spacing `16px` gap:**

| Element | Style |
|---|---|
| ★ Our recommendation | `text-xs font-semibold uppercase tracking-wide text-primary` |
| Direction name | `text-xl font-semibold` |
| Why this works | `text-sm text-muted-foreground`, max 2 lines desktop / 3 mobile |
| Designed to drive | `text-sm`: label muted, value `font-medium text-foreground` |
| Strategy tags | Horizontal chip row, `gap-8px`, chips `text-xs` outline variant |

**CTA group — `16px` gap, horizontal desktop / stacked mobile:**

| CTA | Variant | Width |
|---|---|---|
| Continue with this → | Primary (default) | Desktop: auto. Mobile: full width |
| See 2 other directions | Outline | Desktop: auto. Mobile: full width |

**Tertiary:** **None of these feel right** — `text-sm text-muted-foreground` text link, centered, `24px` below CTA group.

---

### Screen C — Compare Concepts

**Hierarchy:**

1. Progress indicator
2. Collapsed conversation
3. Section label: **Three directions for your campaign** — `text-lg font-semibold`
4. Concept card row
5. Helper text: *Tap a direction to explore it* — `text-xs text-muted-foreground centered`

**Concept cards:**

| Property | Desktop | Mobile |
|---|---|---|
| Layout | 3-column grid, equal width, `16px` gap | Vertical stack, `16px` gap |
| Card padding | `16px` | `16px` |
| Thumbnail height | `120px` | `100px` |
| Recommended badge | Top-left chip on lead card only | same |
| Direction name | `text-sm font-semibold` | same |
| One-line difference | `text-xs text-muted-foreground`, 2 lines max | same |
| Selected/hover | Ring `2px primary` on hover/focus | same |

**Back navigation:** **← Back to recommendation** text link above section label.

---

### Screen D — Focus / Select

**Hierarchy:**

1. Progress indicator
2. Collapsed conversation
3. Header row: direction name (left) + **Compare** link (right)
4. Hero postcard preview (same spec as Lead Reveal)
5. Rationale block (abbreviated — name + why + designed to drive + tags)
6. Primary CTA: **Start refining →**
7. Secondary CTA: **Approve as-is**
8. Switch direction strip

**Switch direction strip:**
- Label: **or switch** — `text-xs text-muted-foreground`
- Two thumbnails `64px × 45px`, `8px` gap, desaturated `60%` default, full color on hover.

---

### Screen E — Refinement

**Desktop layout — two columns:**

| Column | Width | Content |
|---|---|---|
| Left | 62% | Postcard hero (same as Focus), change highlight overlay |
| Right | 38% | Revision history panel, scrollable max-height matches postcard |

**Mobile layout — stacked:**

1. Postcard hero (width 100%, max 320px centered)
2. Revision history (max-height `160px`, scrollable)
3. Composer area
4. Sticky footer

**Composer area:**

| Element | Spec |
|---|---|
| Label | **What would you like to change?** — `text-sm font-medium`, `8px` above textarea |
| Textarea | Min height `80px`, max `160px`, auto-grow |
| Submit | **Apply change** button right-aligned below textarea. Enter key also submits |
| Suggestion chips | Below textarea, `8px` gap, horizontal scroll on mobile |
| Studio-voice response | Below chips, `text-sm`, `16px` top margin, fades in |

**Sticky footer:**

| CTA | Position |
|---|---|
| Compare directions | Left, ghost/text |
| Approve creative → | Right, primary |

---

### Screen F — Approval Interstitial

**Presentation:** Modal overlay within Studio. Backdrop `bg-background/80` blur. Not a route change.

| Property | Value |
|---|---|
| Modal max-width | `480px` |
| Modal padding | `32px` |
| Border radius | `12px` |
| Postcard preview | `280px` wide, centered |
| Headline | `text-xl font-semibold`, centered, `16px` below preview |
| Body copy | `text-sm text-muted-foreground`, centered, `8px` below headline |
| Metric line | `text-sm`, centered, `16px` below body |
| CTA group | Stacked mobile / horizontal desktop, `12px` gap, `24px` below metric |

**Focus trap:** Yes. See Accessibility.

---

### Screen G — Audience Handoff

Studio chrome reduces. Persistent creative header sticky. Audience stage (Campaign Creator) renders in remaining content area with `24px` gap below header.

Studio-specific UI (stage, composer, concept cards) is not rendered.

---

### Responsive summary

| Breakpoint | Width | Layout decisions |
|---|---|---|
| Mobile | `< 640px` | Single column. Full-width CTAs. Thumbnails stack. Compare cards stack. Refinement stacks. Progress labels visible but compact |
| Tablet | `640px – 1024px` | Two-column refinement optional at `768px+`. Compare grid 3-column if fits, else 2+1 |
| Desktop | `≥ 1024px` | Full layout as specified. Max content width `896px` |

---

### Collapsed conversation behavior

| Property | Spec |
|---|---|
| **Container** | Rounded `12px`, border `1px`, background `card/50` |
| **Trigger** | Full-width button: **View conversation (N messages)** + chevron |
| **Collapsed height** | `48px` |
| **Expanded max-height** | `256px`, scrollable |
| **Message styling** | Same as Interview mode but at `text-sm`, reduced padding |
| **Default state** | Collapsed |
| **During generation** | Collapsed |
| **During refinement** | Collapsed — customer focuses on artifact |

---

## 4. Motion Design

### Principles

1. **Animate the artifact, not the chrome.** The postcard moves, highlights, and shimmers. Panels do not slide excessively.
2. **Confidence, not excitement.** No confetti, bounce, or gamification.
3. **Every animation ≤ 600ms** except highlight fade (1500ms) and ambient breathing (3000ms loop).
4. **Spring only for reveals** — one subtle spring on concept entrance (damping 20, stiffness 300).
5. **`prefers-reduced-motion: reduce`** — all motion collapses to opacity-only transitions at `150ms`. No scale, rotate, shimmer, or breathing.

---

### Transition: Interview → Studio

| Property | Value |
|---|---|
| **Trigger** | Strategy confirmed |
| **Interview column** | Opacity `1 → 0`, `200ms`, ease-out. Removed from DOM after |
| **Studio column** | Opacity `0 → 1`, `300ms`, ease-out, `100ms` delay |
| **Content width** | `672px → 896px` max-width transition, `400ms`, ease-in-out |
| **Reduced motion** | Crossfade `150ms` only |

---

### Generation — ambient breathing

| Property | Value |
|---|---|
| **Element** | Stage gradient + silhouette |
| **Animation** | Opacity pulse `0.6 ↔ 1.0` |
| **Duration** | `3000ms` |
| **Easing** | ease-in-out |
| **Loop** | Infinite until generation completes |

---

### Generation — narrative crossfade

| Property | Value |
|---|---|
| **Trigger** | Every 2.5 seconds, new narrative line |
| **Outgoing line** | Opacity `1 → 0`, `200ms` |
| **Incoming line** | Opacity `0 → 1`, `200ms` |
| **Reduced motion** | Instant swap, no fade |

---

### Generation → Lead Reveal

| Property | Value |
|---|---|
| **Trigger** | Status `generating_creative` → `creative_ready` |
| **Stage gradient** | Brightens opacity `+20%`, `300ms` |
| **Silhouette** | Fades out, `200ms` |
| **Narrative panel** | Slides down `8px` + fades out, `250ms` |
| **Postcard** | Scale `0.92 → 1.0`, opacity `0 → 1`, spring damping 20 |
| **Recommendation text** | Fade up `y: 8 → 0`, `200ms`, delay `150ms` |
| **Rationale** | Same, delay `300ms` |
| **CTAs** | Fade in, delay `450ms` |
| **Total choreography** | ~700ms perceived |

---

### Compare — card entrance

| Property | Value |
|---|---|
| **Trigger** | See 2 other directions |
| **Lead card** | Scale down slightly `1.0 → 0.96`, `200ms` — makes room |
| **Alt cards** | Slide in from right `x: 24 → 0`, opacity `0 → 1`, stagger `100ms` each |
| **Reduced motion** | All cards fade in together, `150ms` |

---

### Concept switch (Focus ↔ Focus)

| Property | Value |
|---|---|
| **Trigger** | Tap different direction thumbnail |
| **Outgoing preview** | Opacity `1 → 0`, `150ms` |
| **Incoming preview** | Opacity `0 → 1`, `150ms` |
| **Crossfade** | Simultaneous |

---

### Selection affirmation

| Property | Value |
|---|---|
| **Trigger** | Continue with this |
| **Postcard** | Single pulse ring: border `2px primary/20` expanding outward, `400ms`, one cycle only |

---

### Refinement — shimmer sweep

| Property | Value |
|---|---|
| **Trigger** | Customer submits refinement |
| **Overlay** | Linear gradient sweep left-to-right across postcard |
| **Duration** | `600ms` |
| **Easing** | linear |
| **Reduced motion** | Postcard opacity `0.7 → 1.0`, `300ms` |

---

### Refinement — change highlight

| Property | Value |
|---|---|
| **Trigger** | Refinement applied successfully |
| **Affected region** | Border `2px` primary at `40%` opacity |
| **Duration** | `1500ms` fade out |
| **Easing** | ease-in-out |

---

### Revision history — new entry

| Property | Value |
|---|---|
| **Trigger** | New revision created |
| **Entry** | Slide in from top `y: -8 → 0`, opacity `0 → 1`, `200ms` |

---

### Revision restore

| Property | Value |
|---|---|
| **Trigger** | Tap prior version |
| **Postcard** | Crossfade, `300ms` |

---

### Approval — settle + badge

| Property | Value |
|---|---|
| **Trigger** | Approve creative confirmed |
| **Postcard in modal** | Scale `1.0 → 0.98 → 1.0`, `400ms`, spring |
| **Checkmark badge** | Fade in top-right corner of thumbnail, `200ms`, delay `200ms` |
| **Modal** | Fade out `200ms` |
| **Persistent header** | Slide down from top `y: -16 → 0`, `250ms` |

---

### Hover states

| Element | Behavior |
|---|---|
| Postcard preview | `rotateY(2deg)`, shadow deepens one step. `200ms` ease |
| Concept card | Ring `2px primary/30`. `150ms` |
| Switch direction thumbnail | Desaturation `60% → 100%`. `150ms` |
| Suggestion chip | Background darkens one step. `100ms` |
| CTA buttons | Standard shadcn hover — no custom animation |

Touch devices: hover states disabled. Active/pressed states use opacity `0.9`.

---

## 5. AI Copy

All copy is **Presentation mode** or **Collaboration mode** per AI System. Never chat bubbles in Studio. Never "As an AI…" Never "Generated."

Dynamic values appear in `{curly braces}`.

---

### 5.1 Generation narration

Lines cycle every **2.5 seconds** in order. Skip lines whose `{variable}` is empty.

**Line 1:**
> Understanding your goal: {goal}.

**Line 2:**
> Designing for {audienceDescription}.

**Line 3:**
> Optimizing for {primarySuccessMetricDescription}.

**Line 4:**
> Exploring three creative directions for {businessName}.

**Line 5 (slow state, 15s+):**
> Taking a little longer — making sure each direction is genuinely distinct.

**Line 6 (only if Line 5 was shown and 30s+):**
> Almost ready — finishing your concepts now.

---

### 5.2 Lead concept introduction

**Section label (UI chrome, not AI voice):**
> Your concepts are ready

**Recommendation label:**
> ★ Our recommendation

**Direction name:** `{directionName}` — generated per concept, 2–4 words.

**Why this works (lead only):**
> {leadRationale}

*Example:*
> Clean, professional layout that leads with your 15% off offer and puts the booking QR front and center. Best for homeowners who need confidence before calling a contractor they haven't used.

**Designed to drive (all concepts):**
> Designed to drive: {primarySuccessMetricDescription}

---

### 5.3 Compare view

**Section label:**
> Three directions for your campaign

**Helper:**
> Tap a direction to explore it

**One-line difference (alt concepts only):**
> {altOneLineDifference}

*Examples:*
> Leads with urgency and a time-limited offer — best if you want immediate response.
> Warm, neighborhood-focused tone — best if you want to feel like a trusted local business.

**Back link:**
> ← Back to recommendation

---

### 5.4 Focus / Select caption

One caption only, shown once on entering Focus. Dismissed on interaction. Never repeated.

**Template (selected = lead/recommended):**
> This direction leads with {strategicLeadElement} — a strong choice for {audienceDescription}.

**Template (selected = non-lead):**
> {directionName} takes a {toneAdjective} approach — {oneLineDifference}.

*Examples:*
> This direction leads with trust before the offer — a strong choice for homeowners in Irvine.
> Bold Seasonal Offer takes a more urgent approach — leads with your limited-time discount to drive faster response.

---

### 5.5 Refinement

**Composer label:**
> What would you like to change?

**Composer placeholder (rotates every 5s when idle):**
- Make the headline bigger.
- Use warmer colors.
- Move my phone number to the bottom right.
- Make the QR code more prominent.
- Add my logo.

Placeholder selection is contextual: if `{logoUploaded}` is false, always include "Add my logo." If metric is QR, always include "Make the QR code more prominent."

**Applying state:**
> Applying your change…

**Success confirmation templates:**

Single change:
> Done — {changeDescription}. {preservationNote}.

*Example:*
> Done — headline is larger and your phone number is now bottom-right. The QR code stays centered since that's your primary booking path.

Multiple changes:
> Done — {changeList}. {preservationNote}.

*Example:*
> Done — headline is larger, the border is green, and your phone number moved to the bottom-right. Your offer and QR code are unchanged.

**Preservation note (append when relevant, omit when nothing to preserve):**
> Your {preservedElements} {is/are} unchanged.

---

### 5.6 Conflict explanations

**Remove QR when metric is QR-based:**
> I'd recommend keeping the QR code — {primarySuccessMetricDescription} is your primary success metric, and the QR is the fastest path there. I can make it smaller or move it if it's competing visually. What would you prefer?

**Remove phone when metric is phone-based:**
> Phone calls are how you'll measure success for this campaign, so I'd keep your number visible. I can make it smaller or move it — what works better for you?

**Remove offer when offer was in brief:**
> Your offer is a core part of this campaign's goal. I'd keep it visible — want me to make it bigger, smaller, or move it instead?

**Ambiguous "make it better":**
> Better how — bolder, warmer, or more focused on the offer?

**Generic conflict:**
> That change could work against your goal of {goal}. {alternativeSuggestion}.

---

### 5.7 Regeneration ("None of these feel right")

**Prompt label (composer activates):**
> Tell us what's not landing.

**Composer placeholder:**
> Too corporate. I want more focus on the offer. Show a technician, not a logo.

**Confirmation before regenerating:**
> Got it — I'll create three new directions with {constraintSummary}.

*Example:*
> Got it — I'll create three new directions with a warmer, more personal feel and feature your team instead of stock imagery.

**Regeneration cap reached (after 2 full regenerations):**
> We've explored several directions. Tell me what you'd like to adjust in your strategy, or pick the closest option and refine it from there.

---

### 5.8 Approval

**Interstitial headline:**
> Ready to approve this design?

**Body:**
> This is what we'll print and mail. You can still make changes until you confirm your audience.

**Metric line:**
> Designed to drive: {primarySuccessMetricDescription} via {trackingDestination}.

*Example:*
> Designed to drive: Appointment bookings via abcair.com/book

**Primary CTA:**
> Approve creative

**Secondary CTA:**
> Keep refining

**Post-approval (studio voice, once):**
> Creative approved. Next, let's confirm who receives this.

---

### 5.9 Audience handoff

**Bridge line (once, below persistent header):**
> I already have a head start on your audience from our conversation — confirm or adjust below.

**Persistent header status:**
> Creative approved ✓

**Edit creative action:**
> Edit creative

**Edit creative warning (modal if customer taps Edit creative after approval):**
> You can still refine this design. You'll need to approve it again before launching.

---

### 5.10 Error and recovery copy

**Generation failed:**
> Something went wrong creating your concepts. Try again, or tell us what to adjust first.

**Retry CTA:**
> Try again

**Slow network (composer during failed refinement):**
> Having trouble applying that change. Check your connection and try again.

**Empty concept set (internal error state):**
> Your concepts aren't ready yet. Try again in a moment.

---

## 6. Creative Specification

### 6.1 Creative Direction — required fields

Every generated direction must include all fields below. Missing fields block presentation.

| Field | Type | Constraints |
|---|---|---|
| `id` | UUID | Unique per campaign |
| `name` | string | 2–4 words. Editorial, not descriptive of layout. Examples: "Trusted Local Expert", "Bold Seasonal Offer" |
| `rationale` | string | 2 sentences max. Tied to brief goal, audience, and metric. Plain English |
| `tags` | string[] | Exactly 3. Strategic, not visual. Examples: "Offer-led", "QR-forward", "Warm photography" |
| `recommended` | boolean | Exactly one direction per generation set has `true` |
| `spec` | CreativeSpec | See 6.2 |
| `designedToDrive` | string | Customer-language Primary Success Metric. Mirrors brief |
| `oneLineDifference` | string | ≤ 80 characters. Required for non-lead directions. How this differs strategically from lead |
| `preview` | PreviewDescriptor | See 6.3 |
| `createdAt` | ISO timestamp | — |

### 6.2 CreativeSpec — structured specification

Beta renders previews from this spec via template — not freeform images.

| Field | Required | Description |
|---|---|---|
| `format` | Yes | Beta default: `postcard_4x6`. Other values deferred |
| `headline` | Yes | Max 8 words |
| `subheadline` | No | Max 12 words |
| `body` | Yes | Max 40 words |
| `callToAction` | Yes | Max 6 words |
| `offer` | If in brief | Exact offer text from brief |
| `phone` | If in brief | Formatted phone |
| `website` | If in brief | Display URL |
| `qrDestination` | If in brief | Display URL, not raw UTM string |
| `visualDirection` | Yes | One sentence describing imagery approach |
| `tone` | Yes | From brief emotional tone or inferred |
| `palette` | Yes | 3 hex colors: primary, secondary, accent |
| `layoutVariant` | Yes | One of: `offer_hero`, `trust_first`, `urgency_banner`, `photo_led`, `minimal_cta` |
| `imagery` | Yes | One of: `stock_hvac`, `stock_restaurant`, `stock_generic_local`, `logo_primary`, `none`. Beta uses curated stock keyed to industry |
| `backLayout` | Yes | Beta always: `standard_address` — auto-generated address/indicia panel |

### 6.3 PreviewDescriptor

| Field | Value |
|---|---|
| `aspectRatio` | `3:2` |
| `frontRenderKey` | Template variant + spec hash — for cache busting |
| `backRenderKey` | Same |
| `thumbnailRenderKey` | Same at reduced size |

Customer always sees **front first**. Back via toggle.

### 6.4 CreativeRecommendation — lead metadata

| Field | Description |
|---|---|
| `directionId` | ID of recommended direction |
| `headline` | **★ Our recommendation** — UI label is fixed; this field is internal/onboarding only |
| `rationale` | Same as lead direction rationale — duplicated for query convenience |

### 6.5 CreativeRevision — required fields

| Field | Type | Constraints |
|---|---|---|
| `id` | UUID | — |
| `directionId` | UUID | Parent direction |
| `version` | number | Sequential per direction, starting at 1 |
| `spec` | CreativeSpec | Full snapshot — not a diff |
| `customerPrompt` | string | Verbatim customer input |
| `studioResponse` | string | Verbatim confirmation or conflict message |
| `changedRegions` | string[] | Spec field keys that changed — drives highlight animation |
| `createdAt` | ISO timestamp | — |
| `type` | enum | `refinement` \| `restore` |

Version 1 is always **original concept** with `customerPrompt`: "Original concept" and empty `studioResponse`.

### 6.6 Generation set constraints

| Rule | Value |
|---|---|
| Directions per generation | Exactly 3 |
| Distinct layout variants | At least 2 of 3 must differ |
| Distinct messaging angles | All 3 must differ |
| Faithfulness | All must include required brief elements (offer, phone, QR, logo) when present in brief |
| Full regenerations per campaign | Maximum 2, then cap copy (Section 5.7) |

---

## 7. Component Inventory

State ownership: **Campaign page** holds campaign record via server actions. Studio components receive campaign slices as props and emit intents upward. No component fetches directly.

### 7.1 Composition hierarchy

```
CampaignCreatorView
├── CampaignCreatorLayout (existing — mode switch)
│   ├── CampaignProgress (existing)
│   ├── [Interview mode — out of scope]
│   └── [Studio mode]
│       └── CreativeStudio
│           ├── CollapsedConversation (existing)
│           ├── CreativeStudioStage (orchestrator — routes by sub-phase)
│           │   ├── GenerationView
│           │   ├── LeadRevealView
│           │   ├── CompareView
│           │   ├── FocusView
│           │   ├── RefinementView
│           │   └── ApprovalModal
│           ├── PersistentCreativeHeader (post-approval only)
│           └── [AudienceStage — Campaign Creator, below Studio]
```

### 7.2 Components

#### `CreativeStudio`

| | |
|---|---|
| **Responsibility** | Orchestrates Studio sub-phase from campaign status + creative state. Renders PersistentCreativeHeader when approved |
| **Props** | `campaign: Campaign`, `onIntent: (intent: StudioIntent) => void`, `isPending: boolean` |
| **State** | None local — derived from props |
| **Sub-phases derived** | `generating` \| `lead` \| `compare` \| `focus` \| `refine` \| `feedback` |

#### `GenerationView`

| | |
|---|---|
| **Responsibility** | Stage silhouette, breathing animation, narrative rotation, disabled composer |
| **Props** | `brief: CampaignBrief`, `narrativeIndex: number`, `isSlow: boolean` |
| **State** | Local: narrative timer only |

#### `LeadRevealView`

| | |
|---|---|
| **Responsibility** | Hero preview, recommendation block, primary/secondary CTAs, tertiary link |
| **Props** | `leadDirection: CreativeDirection`, `onContinue: () => void`, `onCompare: () => void`, `onFeedback: () => void` |

#### `CompareView`

| | |
|---|---|
| **Responsibility** | Three concept cards, back navigation |
| **Props** | `directions: CreativeDirection[]`, `recommendedId: string`, `onSelect: (id) => void`, `onBack: () => void` |

#### `ConceptCard`

| | |
|---|---|
| **Responsibility** | Thumbnail, name, badge, one-line difference. Reused in Compare and switch strip |
| **Props** | `direction: CreativeDirection`, `variant: 'hero' \| 'compact' \| 'strip'`, `isRecommended?: boolean`, `onSelect?: () => void` |

#### `FocusView`

| | |
|---|---|
| **Responsibility** | Hero preview, caption, Start refining / Approve as-is, switch strip |
| **Props** | `direction: CreativeDirection`, `otherDirections: CreativeDirection[]`, `caption: string`, `onRefine: () => void`, `onApprove: () => void`, `onSwitch: (id) => void`, `onCompare: () => void` |

#### `RefinementView`

| | |
|---|---|
| **Responsibility** | Two-column layout, composer, sticky footer |
| **Props** | `direction: CreativeDirection`, `revisions: CreativeRevision[]`, `activeSpec: CreativeSpec`, `suggestionChips: string[]`, `studioResponse?: string`, `isApplying: boolean`, `onSubmit: (prompt) => void`, `onApprove: () => void`, `onCompare: () => void` |

#### `PostcardPreview`

| | |
|---|---|
| **Responsibility** | Renders front/back from CreativeSpec. Handles toggle, hover tilt, highlight regions, shimmer overlay |
| **Props** | `spec: CreativeSpec`, `side: 'front' \| 'back'`, `onSideChange`, `highlightRegions?: string[]`, `isShimmering?: boolean`, `size: 'hero' \| 'medium' \| 'thumbnail'`, `showBadge?: boolean` |
| **Reused by** | LeadReveal, Focus, Refinement, Approval, PersistentHeader |

#### `RevisionHistoryPanel`

| | |
|---|---|
| **Responsibility** | Ordered revision list, restore action, current badge |
| **Props** | `revisions: CreativeRevision[]`, `activeVersion: number`, `onRestore: (version) => void` |

#### `StudioComposer`

| | |
|---|---|
| **Responsibility** | Natural-language input, suggestion chips, submit. Distinct from Interview Composer (different placeholder logic, label) |
| **Props** | `value`, `onChange`, `onSubmit`, `placeholder`, `suggestionChips`, `disabled`, `label`, `isApplying` |

#### `ApprovalModal`

| | |
|---|---|
| **Responsibility** | Focus-trapped interstitial, approve/keep refining |
| **Props** | `spec: CreativeSpec`, `metricLine: string`, `onApprove`, `onKeepRefining`, `isConfirming` |

#### `PersistentCreativeHeader`

| | |
|---|---|
| **Responsibility** | Sticky approved creative bar post-approval |
| **Props** | `direction: CreativeDirection`, `spec: CreativeSpec`, `onEditCreative: () => void` |

#### `FeedbackComposer` (regeneration)

| | |
|---|---|
| **Responsibility** | Expanded composer state for "None of these feel right" |
| **Props** | `onSubmit: (feedback) => void`, `regenerationCount: number`, `onCancel: () => void` |

#### `StrategyTags`

| | |
|---|---|
| **Responsibility** | Horizontal chip row from direction tags |
| **Props** | `tags: string[]` |

#### `StudioVoiceLine`

| | |
|---|---|
| **Responsibility** | Inline AI copy — not chat bubble. Fade in/out |
| **Props** | `children: string`, `visible: boolean` |

### 7.3 StudioIntent union (parent handler)

| Intent | Payload |
|---|---|
| `CONFIRM_STRATEGY` | — |
| `CONTINUE_WITH_LEAD` | — |
| `SHOW_COMPARE` | — |
| `SELECT_DIRECTION` | `{ directionId }` |
| `START_REFINING` | — |
| `APPROVE_AS_IS` | — |
| `SUBMIT_REFINEMENT` | `{ prompt }` |
| `RESTORE_REVISION` | `{ version }` |
| `SHOW_APPROVAL` | — |
| `APPROVE_CREATIVE` | — |
| `KEEP_REFINING` | — |
| `SUBMIT_REGENERATION_FEEDBACK` | `{ feedback }` |
| `EDIT_CREATIVE` | — |
| `SWITCH_DIRECTION` | `{ directionId }` |

---

## 8. State Machine

### 8.1 Campaign status states

| Status | Studio sub-phase | Entry action | Exit action |
|---|---|---|---|
| `strategy_confirmed` | — (transient) | Layout → Studio. Begin generation | Auto-advance to `generating_creative` |
| `generating_creative` | `generating` | Start narrative. Call creative engine | On success → `creative_ready`. On fail → stay, show error |
| `creative_ready` | `lead` (default UI) | Present lead direction | Customer selects/refines/regenerates |
| `creative_approved` | — (Studio UI hidden) | Show persistent header. Enable audience | Audience confirmed → `audience_confirmed` |

**Note:** `compare`, `focus`, `refine`, and `feedback` are **UI sub-states** within `creative_ready` — not persisted as campaign status in beta. Persist `selectedDirectionId` and revision stack on campaign; sub-phase is derived in client state from last action.

Persist on campaign when leaving `creative_ready`:
- `selectedDirectionId`
- `creative.directions[]`
- `creative.revisions[]`
- `creative.approvedRevisionId` (on approval)

### 8.2 UI sub-state transitions (within `creative_ready`)

```
lead ──Continue with this──→ focus
lead ──See 2 other──→ compare
lead ──None of these──→ feedback
compare ──Select card──→ focus
compare ──Back──→ lead
focus ──Start refining──→ refine
focus ──Approve as-is──→ approval modal
focus ──Switch direction──→ focus (different direction)
refine ──Approve creative──→ approval modal
refine ──Compare directions──→ compare
refine ──Restore revision──→ refine (updated spec)
feedback ──Submit──→ generating (regeneration)
approval ──Approve──→ creative_approved
approval ──Keep refining──→ refine (or focus if no refinements yet)
```

### 8.3 Recovery paths

| Condition | Behavior |
|---|---|
| Generation fails | Stay `generating_creative`. Show error + **Try again**. Retry calls engine again |
| Generation timeout (45s) | Same as failure |
| Partial generation (< 3 directions) | Do not present. Treat as failure. Retry |
| Refinement fails | Stay in `refine`. Show error inline. Composer re-enabled. Spec unchanged |
| Customer refreshes mid-Studio | Resume from campaign status + persisted creative state |
| Customer navigates away mid-generation | Generation continues server-side. On return, show current status |
| Regeneration cap hit | `feedback` shows cap copy. Customer must refine or edit strategy |
| Edit creative after approval | Confirm modal → status returns to `creative_ready`, sub-phase `refine`. Clears `approvedRevisionId`. Requires re-approval |

### 8.4 Empty states

| State | Condition | Display |
|---|---|---|
| No directions after `creative_ready` | Internal error | Error copy 5.10 + Try again |
| No revisions | Entering refine before any edit | History shows v1 only |
| No conversation | Collapsed conversation hidden | Do not render CollapsedConversation |

### 8.5 Slow network states

| Threshold | UI |
|---|---|
| Generation 15s | Show slow narration line (5.1 Line 5) |
| Generation 30s | Show Line 6 |
| Generation 45s | Fail state |
| Refinement 8s | Composer shows "Applying your change…" |
| Refinement 20s | Inline error: slow network copy (5.10) |

---

## 9. Accessibility

### Keyboard navigation

| Context | Keys |
|---|---|
| Lead reveal | `Tab` through CTAs and tertiary link. `Enter`/`Space` activates |
| Compare cards | Cards are focusable buttons. `Arrow keys` move between cards horizontally (desktop). `Enter` selects |
| Front/back toggle | `Arrow left/right` switches side when toggle focused |
| Refinement composer | Standard textarea. `Enter` submits. `Shift+Enter` newline |
| Approval modal | Focus trapped. `Escape` → **Keep refining**. `Tab` cycles Approve / Keep refining |
| Persistent header | **Edit creative** focusable |

### Focus management

| Event | Focus target |
|---|---|
| Studio opens | First narrative line (decorative) → skip link targets first CTA when reveal completes |
| Lead reveal completes | **Continue with this** |
| Compare opens | First non-lead card (lead already seen) OR lead if keyboard-navigated |
| Refinement opens | Composer textarea |
| Approval opens | **Approve creative** |
| Approval closes (Keep refining) | Composer textarea |
| Approval closes (Approved) | Audience stage first field |
| Modal Escape | Trigger element |

### Screen reader

| Element | Announcement |
|---|---|
| Generation start | Live region polite: "Creating your creative concepts." |
| Generation complete | Live region polite: "Your concepts are ready. {leadDirectionName} is recommended." |
| Refinement applied | Live region polite: "{studioResponse}" |
| Conflict | Live region assertive: "{conflictMessage}" |
| Approval confirmed | Live region polite: "Creative approved." |
| Progress indicator | Each step has `aria-label`: "{Step name}, {complete|current|upcoming}" |
| Postcard preview | `aria-label`: "Postcard preview, {front/back}, {headline text}" |
| Revision restore | "Restored version {n}" |

### Motion reduction

When `prefers-reduced-motion: reduce`:
- All Section 4 animations collapse to 150ms opacity fades
- No shimmer, breathing, spring, tilt, or pulse
- Change highlight becomes 1s static border, no animation
- Narrative lines swap instantly

### Contrast

- All text meets WCAG AA against background
- Strategy tags use outline variant — not opacity-only differentiation
- Disabled composer maintains readable placeholder at `opacity 0.5` minimum on text, not container
- Changed-region highlight border: primary at 40% opacity minimum — must remain visible on reduced motion

### Skip link

Studio mode includes visually hidden skip link: **Skip to main action** — targets primary CTA of current sub-phase.

---

## 10. Beta Scope

### Ships in beta

| Capability | Specification |
|---|---|
| Auto-start generation on strategy confirm | Yes |
| Template-rendered 4×6 postcard previews from CreativeSpec | Yes |
| Front/back toggle | Yes — back is auto-generated address layout |
| Exactly 3 directions per generation | Yes |
| Lead-first reveal with compare opt-in | Yes |
| Skip refinement (Approve as-is) | Yes |
| Natural-language refinement | Yes |
| Revision history with restore | Yes |
| Conflict detection for metric-critical elements | Yes — QR, phone, offer |
| Explicit approval interstitial | Yes |
| Reversible approval until audience confirmed | Yes |
| Persistent creative header through audience | Yes |
| Max 2 full regenerations | Yes |
| Generation narration from brief templates | Yes |
| All motion specified in Section 4 | Yes |
| Full accessibility in Section 9 | Yes |

### Deferred (not beta)

| Capability | Reason |
|---|---|
| AI-generated photography / inpainting | Template + curated stock sufficient for beta |
| 6×9, letter, self-mailer formats | 4×6 only |
| Logo upload during refinement | Phase 2 — beta shows "Add my logo" chip disabled with tooltip: "Logo upload coming soon" OR triggers Interview-era asset field |
| Print-ready PDF export | Launch milestone |
| Pixel-level drag editing | Never — product principle |
| Fourth concept option | Never — product principle |
| Side-by-side diff view | Never — product principle |
| Live LLM streaming during generation narration | Template narration sufficient |
| Separate studio route/URL | Same campaign URL, mode by status |
| Creative A/B testing | Post-beta |
| Brand kit / saved styles | Post-beta |
| Multi-piece campaigns (series) | Post-beta |

### Non-goals

- Creative Studio is **not** a design tool.
- Creative Studio is **not** a chatbot.
- Creative Studio does **not** auto-approve or auto-launch.
- Creative Studio does **not** expose AI, model, or generation terminology to the customer.
- Creative Studio does **not** optimize for number of concepts, regenerations, or time-on-screen.

### Future enhancements (post-beta, unordered)

- AI-generated imagery in template image slots
- Logo upload inline during refinement
- Additional mail formats
- Brand profile influencing default palette and tone
- "Similar to last campaign" direction shortcut
- Creative performance feedback loop (which directions correlate with strong metrics)
- Live narration streaming from LLM during generation

---

## Success criteria

Beta Creative Studio succeeds when:

1. A first-time customer reaches `creative_approved` in under 5 minutes on the happy path (lead → approve as-is).
2. In user testing, customers describe the experience as "having a designer" — not "using AI."
3. Fewer than 15% of customers hit regeneration cap.
4. Fewer than 10% abandon during generation.
5. Zero customers ask "where is the editor?" in moderated sessions.
6. Every concept displayed includes rationale tied to Primary Success Metric.

---

## Appendix — Relationship to Campaign Creator

| Campaign Creator owns | Creative Studio owns |
|---|---|
| Interview / strategy confirmation | Everything from generation through creative approval |
| Audience stage (post-approval) | Persistent creative header during audience |
| Quantity & tracking | — |
| Launch review | — |

Studio hands off to Campaign Creator at `creative_approved`. The handoff is a status change and layout reduction — not navigation to a new page.

---

## Appendix — Document maintenance

Update this PRD when:

- Founder review changes Studio behavior
- Beta learnings require copy or flow changes
- New mail formats ship (add to 6.2, 10)
- Accessibility standards change

Do not update this PRD for implementation details. Implementation docs conform to this PRD.
