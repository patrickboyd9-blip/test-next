# A+ Postcard Design Rubric — Modern Mail

**Scope:** 6x9 and 5x8 local-service postcards (roofing, HVAC, dental, plumbing, etc.), printed through Click2Mail.
**Use:** Run Section 1 (auto-fails) first. One fail means the card is rejected and goes back for regeneration. Then score Section 2 (weighted 1–10). Ship to Patrick only if there are **0 auto-fails and the weighted score is ≥ 8.0**.
**Grounding:** Principles P1–P12 (`notes/transferable-principles-draft.md`), craft notes (`notes/*.md`), anti-patterns AP-001–AP-012 (`references/anti-pattern-examples.md`), report (`drafts/`).
**Evidence labels:** **[E]** = supported by library references or published standards (WCAG, USPS, ISO QR). **[C]** = practitioner convention or Modern Mail house rule. It is a working default, not proven. Tune it with response data.

---

## 0. Print geometry (Click2Mail)

| | 5x8 | 6x9 |
|---|---|---|
| Trim | 5 × 8 in | 6 × 9 in |
| Artboard w/ 0.25in bleed (all sides) | 5.5 × 8.5 in | 6.5 × 9.5 in |
| Safe zone (all text ≥0.25in inside trim) | 4.5 × 7.5 in | 5.5 × 8.5 in |
| Pixels @300dpi (with bleed) | 1650 × 2550 | 1950 × 2850 |

- Photos and background color extend to the bleed edge. All live text, QR codes, and logos stay inside the safe zone. **[E]** Click2Mail spec (verified 2026-10-09, see below). Click2Mail recommends 300 DPI; 100 DPI is its stated minimum. Confirm against the downloaded template before production.
- **Address side:** keep the Click2Mail address/indicia/barcode block completely clear. This includes the USPS barcode clear zone in the lower-right corner of the address side: 4.75 in from the right edge × 0.625 in from the bottom edge (DMM 202.5.1.1; required on machinable/automation letter-size pieces unless the IMb is in the address block). **[E]** USPS DMM. Use the Click2Mail template overlay as the source of truth.
- Effective image resolution must be ≥300 ppi at placed size. **[E]** print standard.

## 1. Auto-fail checklist (any FAIL → reject)

| # | Rule | Pass condition | Check | Source |
|---|---|---|---|---|
| AF1 | **Invisible / low-contrast text** (e.g., pale headline on cream panel) | Headline, offer, and CTA contrast ≥ 4.5:1 against the sampled background. Large display text (≥24pt) ≥ 3:1 minimum, and ≥ 4.5:1 is the house target. | Machine | [E] WCAG 2.x 1.4.3 (screen standard used as a floor for print); typography-intelligence, color-intelligence |
| AF2 | **Clipped / overflowing headline** | Every glyph of the headline fully inside the safe zone. No text-box overflow, no ellipsis, no hyphen break inside a word. | Machine | [E] print spec; AP-006 |
| AF3 | **Headline > 8 words** | ≤ 8 words. Target is 3–6. | Machine | [C] house rule; P3, information-hierarchy |
| AF4 | **Photo confined to small box** | Hero photo ≥ 40% of front panel area, or full-bleed. No hero photo inside a framed box under 25% of the area. | Machine (bbox) | [C] threshold; P1, P2, imagery-art-direction, AP-001/AP-002 |
| AF5 | **Flat type scale** | Headline cap-size ≥ 2.5× body size. Offer ≥ 1.5× body. | Machine | [C] ratio; P3 ("hierarchy is scale, weight, space first"), typography-intelligence |
| AF6 | **Text/QR/logo outside safe zone** | All live elements inside the safe box. | Machine | [E] Click2Mail spec |
| AF7 | **Missing or unscannable response path** | Phone number present at ≥ 11pt, and/or a QR code ≥ 0.75in with a 4-module quiet zone, ≥ 3:1 contrast (dark on light), that decodes to a live URL. | Machine (decode + HTTP 200) | [E] ISO/IEC 18004 quiet zone; P7, functional-elements-qr-contact |
| AF8 | **Competing focal points / widget stack** | Exactly 1 dominant focal element. Fewer than 4 boxed/badged modules on the front. No more than 1 starburst/sticker. | Hybrid | [E-library] P2, P11, AP-006, AP-008 |
| AF9 | **Text over busy image without scrim** | Text sitting on a photo region needs local contrast ≥ 4.5:1 *and* either a scrim/gradient or a low-texture region (luminance std-dev under the text box below the threshold, about 0.12). | Machine | [E] WCAG; [C] variance threshold; color-intelligence |
| AF10 | **Address-side clear zone violated** | No art or text in the address/indicia/barcode area. | Machine (template mask) | [E] USPS / Click2Mail |

## 2. Weighted score (1–10)

Score each dimension 1–10. Weighted total = Σ(score × weight).

### D1. Hierarchy & type scale — 25%
Order must read **headline > offer > CTA > contact** (P3, P5, P9; information-hierarchy, cta-offer-design).

**Target sizes at print size [C]** (assumes a sans at normal x-height; condensed faces can run about 10% larger):

| Element | 5x8 | 6x9 | Ratio vs body |
|---|---|---|---|
| Headline | 40–60 pt | 48–72 pt | ≥ 3× (fail < 2.5×) |
| Offer (numeral-as-hero, P4) | 28–44 pt | 32–54 pt | ≥ 2× |
| CTA line | 16–22 pt | 18–24 pt | ≥ 1.3× |
| Body | 10–12 pt | 11–13 pt | 1× (min 9pt) |
| Phone/contact | 12–16 pt bold | 14–18 pt bold | ≥ 1.2× |
| Legal/fine print | ≥ 7 pt | ≥ 7 pt | — |

- **3:** Sizes are within 1.5× of each other. The eye has no entry point.
- **6:** The headline is clearly largest, but the offer and CTA tie, or the phone number outshouts the offer.
- **9:** A blind squint test still shows a four-step ladder. The offer numeral is a hero (P4). The primary CTA is visually declared (P9).

### D2. Headline craft — 15%
- **3:** A sentence-length headline (9+ words) that wraps to 3+ lines and reads like generic copy ("We provide quality roofing services…").
- **6:** 5–8 words, clear, but category-cliché (AP-004: "Is your roof ready?").
- **9:** 3–6 words. Specific and benefit- or blocker-led (P6). Sets on 1–2 lines with deliberate breaks.

### D3. Photo / art direction — 20%
Premium vs stock signals (imagery-art-direction, premium-vs-template, AP-005, AP-007):
- **Premium [E-library]:** a real local job or person, natural light, one subject, shallow depth or a strong crop, color graded to the palette, a plausible imperfection.
- **Stock tells:** a smiling couple or thumbs-up tech looking at the camera, glossy AI over-polish, generic sky, a watermark-like crispness, visible clutter.
- Full-bleed is the default. A panel layout is acceptable only if the photo panel is ≥ 50% and runs to the bleed on at least 2 edges [C].
- **3:** A stock-tell photo in a small box (< 25% of the area).
- **6:** A decent photo at 30–45% of the area, in a split panel, with a generic subject.
- **9:** Full-bleed or a ≥ 55% hero. One subject chosen to address the buyer's blocker (P6). Text is integrated by negative space or a scrim. 300 ppi.

### D4. Contrast & legibility — 15%
- Minimums: body ≥ 4.5:1. Headline ≥ 4.5:1 house target (3:1 is the absolute floor at ≥ 24pt). Body ≥ 9pt. No reversed text under 9pt. No thin weights (< 400) under 14pt [E WCAG / C print].
- **3:** Any element below 3:1, or a script or thin face used for the offer.
- **6:** Everything ≥ 4.5:1, but there is some text on photo texture or a light weight.
- **9:** Primary text ≥ 7:1. Every text block sits on a calm field or scrim. It reads cleanly at arm's length (about 3 ft).

### D5. Composition & whitespace — 15%
(P2, P8, P10; composition-intelligence, negative-space-material)
- Margins: ≥ 0.25in from trim for primary text [C]. Gutters between modules ≥ 0.2in. At least 20–30% of the front panel is calm field (photo sky, solid color, or empty) [C].
- **3:** A collage of boxes, badges, and starbursts with no breathing room (AP-006). UI chrome such as buttons and fake browser bars (P11).
- **6:** An organized grid with all modules boxed. Safe, but template-like (AP-001).
- **9:** One composed object (P2). Generous negative space used as emphasis (P8). At most one deliberate grid break (P10).

### D6. Response path (QR/phone/CTA) — 10%
(P7, P9; functional-elements-qr-contact)
- **QR:** ≥ 0.75in at minimum, 0.9–1.0in recommended. 4-module quiet zone. Placed near the CTA in the lower third, never across the fold of the photo subject. Paired with a one-line verb label ("Scan for your $0 inspection") [E-library/C].
- **Phone:** bold, ≥ 12pt (5x8) or ≥ 14pt (6x9), next to the CTA, formatted (555) 555-0123. Repeated on the address side.
- **3:** A tiny unlabeled QR in a corner, or the phone buried in the footer.
- **6:** The QR and phone are present and legible, but disconnected from the CTA.
- **9:** The CTA, QR, and phone form one designed response module (P7). The primary vs secondary action is obvious (P9).

**Gate:** Weighted score ≥ 8.0 means it can go to Patrick. 6.0–7.9 means a targeted fix. Below 6.0 means regenerate.

## 3. Worked examples

**A. Pale headline on cream panel** (roofing, 6x9). Headline in #E9D8B4 on #F6EFE1 has a contrast of about 1.2:1.
→ **AF1 FAIL.** For reference: D4 = 2, D1 = 5 (the size is fine but the headline is invisible), so it would score below 5.0. **Fix:** set the headline in a near-black brand color (≥ 7:1) or reverse it white on a dark photo scrim.

**B. Sentence headline that clips** (HVAC, 5x8). "Don't let your old air conditioner leave your family sweating this summer — call today" is 14 words, wraps to 4 lines, and the last line runs past the safe zone.
→ **AF2 + AF3 FAIL.** D2 = 2. **Fix:** "AC Dead? Fixed Today." (4 words, 56pt). The rest of the sentence moves to body copy or gets cut.

**C. Photo stuck in a small box** (dental, 6x9). A 2.5 × 2in stock smile photo covers about 9% of the area and sits in a bordered frame beside a text block.
→ **AF4 FAIL.** D3 = 3, D5 = 4 (AP-001 template look). **Fix:** run a real-patient or office photo full-bleed and place text in its negative space with a bottom gradient scrim.

**D. Flat type sizes** (plumbing, 5x8). Headline 24pt, offer 20pt, body 14pt, phone 18pt. The headline/body ratio is 1.7×.
→ **AF5 FAIL.** D1 = 3, because the phone outshouts the offer. **Fix:** headline 52pt, offer "$49" at 40pt numeral-as-hero (P4), body 11pt, phone 14pt bold.

**A+ reference (roofing, 6x9):** A full-bleed, late-afternoon photo of the crew on a real local roof, with the sky taking the top 35% as calm field. In the sky sits the headline "Storm Damage? Free Roof Check." (5 words), set at 64pt bold in white at about 9:1 contrast against a subtle top gradient. Below it, the offer "$0 Inspection" appears as a 44pt numeral-led line. In the lower third sits one white response module holding the CTA "Book by Oct 31" at 20pt, a 0.9in QR with quiet zone labeled "Scan to book," and the phone at 16pt bold. The logo is small (≤ 1.25in wide), there are no badges or starbursts, and everything sits ≥ 0.25in inside trim. **Scores:** D1 9, D2 9, D3 9, D4 9, D5 9, D6 9, for a total of **9.0**.

## 4. Automation map for the CTO bot

| Check | Type | How |
|---|---|---|
| AF1, AF9, D4 contrast | **Machine** | Render at 300dpi. For each text bbox, sample the background (median and p10/p90). Compute the WCAG relative-luminance ratio. Use luminance std-dev under the text for busy-image detection. |
| AF2, AF6, AF10 | **Machine** | Compare element bboxes with safe/bleed/address masks from the template. Detect text overflow from the layout engine. |
| AF3, D2 word count | **Machine** | Token count on the headline field. |
| AF4, D3 area share | **Machine** | Photo bbox area / front panel area. Check edges touching bleed. |
| AF5, D1 ratios | **Machine** | Read font sizes from the layout JSON. Compute ratios and check the ordering headline > offer > CTA ≥ contact > body. |
| AF7 | **Machine** | Decode the QR from the 300dpi raster (zxing/pyzbar). Check module quiet zone ≥ 4, size ≥ 0.75in, URL returns 200. Regex for phone presence and size. |
| AF8 | **Hybrid** | Count boxed modules, badges, and starbursts from the layout JSON (machine). Judge "one dominant focal point" with a saliency map or a vision-LLM check plus human confirmation. |
| D3 premium vs stock | **Human / vision-LLM** | Check against the stock tells listed in D3 (AP-005, AP-007). |
| D2 headline quality, D5 composition, P6 fit | **Human / vision-LLM** | Score against the 3/6/9 anchors above. |

**Recommended pipeline:** layout JSON + 300dpi render → machine auto-fails (AF1–AF7, AF9, AF10) → machine-scored D1, D4, D6 → vision-LLM scores D2, D3, D5 and AF8 → if total ≥ 8.0 and no fails, send to Patrick.

*Thresholds marked [C] are Modern Mail defaults and should be recalibrated against response and print-proof results.*

---

## Spec verification (2026-10-09)

| Claim | Old | Verified value | Status | Source |
|---|---|---|---|---|
| 5x8 trim | 5 × 8 in | 5 × 8 in | Verified | Click2Mail postcard product sheet |
| 6x9 trim | 6 × 9 in | 6 × 9 in | Verified | Click2Mail support postcard sheet |
| Bleed | 0.125 in | 0.25 in all sides (5x8 → 5.5 × 8.5; 6x9 → 6.5 × 9.5) | Corrected | Click2Mail sheets ("add .25 inch border to artwork (all sides)") |
| Safe zone | ≥0.125 in (house 0.1875) | Keep all text ≥0.25 in inside trim (5x8 → 4.5 × 7.5; 6x9 → 5.5 × 8.5) | Corrected | Click2Mail sheets |
| Pixels @300dpi w/ bleed | 1575×2475 / 1875×2775 | 1650×2550 / 1950×2850 | Corrected (derived) | from bleed above |
| Resolution | 300 dpi | 300 DPI recommended, 100 DPI minimum | Verified | Click2Mail product sheet |
| Other sizes | n/a | Click2Mail "4x6" is 4.25 × 6 (4.75 × 6.5 w/ bleed); 6 × 11 (6.5 × 11.5 w/ bleed) | Verified | Click2Mail product sheet |
| USPS barcode clear zone | ~4.75 × 0.625 in, bottom-right | 4.75 in from right edge, 0.625 in from bottom edge | Verified | USPS DMM 202.5.1.1 |
| USPS postcard vs letter pricing | n/a | **First-Class Mail:** card price applies to a postcard 3.5 × 5 in min up to 6 × 9 in max, 0.007–0.016 in thick (≥0.009 in if over 4.25 × 6), aspect ratio 1.3–2.5 (DMM 201.1.2.1a, c, e). Stamped cards and each half of a double postcard max 4.25 × 6 in (201.1.2.1b). So 4.25x6 ("4x6"), 5x8 and 6x9 qualify for card price; 6x11 exceeds 9 in and is a letter (max 6.125 × 11.5 × 0.25 in, 201.1.1.1). Cards under 0.009 in that are over 4.25 × 6, or outside the aspect ratio, pay nonmachinable letter prices (201.2.1.2). **USPS Marketing Mail:** no card price; every card is priced as a letter (letter-size, max 6.125 × 11.5 in) under 243.4.2 and 243.5.5.1, so 4x6, 5x8, 6x9 and 6x11 all pay letter prices. | Corrected | USPS DMM 201 §1.1.1, §1.2.1, §2.1.2; DMM 243 §4.2, §5.5.1 |
| Address/indicia block size | "use template overlay" | No dimensions published in Click2Mail's public pages | Unverifiable | — use downloaded template |
| Color mode (CMYK/RGB) | not stated | Not stated in Click2Mail sources found | Unverifiable | — |
| 5.5 × 8.5 size | n/a | Not a Click2Mail postcard size; it is the 5x8 bleed artboard | Note | Click2Mail product sheet |

Sources:
- https://click2mail.com/media/downloads/pdf/c2m_postcards_products.pdf
- https://support.click2mail.com/api/v1/articles/507/attachments/2550/download (read via search index; direct download returned an HTML page)
- https://templates.click2mail.com/postcards/6x9 (official templates; masks not machine-readable)
- https://pe.usps.com/text/dmm300/201.htm
- https://pe.usps.com/text/dmm300/202.htm
- https://pe.usps.com/text/dmm300/243.htm

Note: a third-party "Big Mail Project" 6x9 template shows 0.125 in bleed and a 5.875 × 8.875 safe zone. That is not Click2Mail and was not used.

---

## 5. Vision-critic score (phase 2)

Sections 0–4 stay the ship gate: 0 auto-fails and D1–D6 weighted ≥ 8.0. This section is the additional pass a vision model runs against the playbook. It does not replace AF1–AF10.

Score each row 1–5 using `playbook/04-how-to-critique.md`. Weighted total = Σ (score / 5 × weight). A card is critic-clean at **≥ 80** and 0 auto-fails. 65–79 is one structural edit. Below 65, regenerate.

| ID | Criterion | Weight | 5 looks like | 1 looks like |
|---|---|---|---|---|
| V1 | Focal dominance | 10 | One element, 35–50% of visual weight, survives a blur | Two heroes, or no hero |
| V2 | Hierarchy and scale | 12 | Offer ≥ 1.6× headline cap-height when the offer is the hero; else headline ≥ 2.5× body. ≤ 3 type sizes on the front | Sizes within 1.5×, or 5+ sizes |
| V3 | Eye path | 6 | Three stops end at the response | A path that dead-ends on a logo |
| V4 | Grid and balance | 8 | One named grid, one axis, at most one break | Mixed alignments, or symmetry with two equal offers |
| V5 | Gestalt | 6 | Offer is one group, response is one group | Orphan icons, phone far from the code |
| V6 | Contrast and figure-ground | 8 | Primary type ≥ 4.5:1 (house ≥ 7:1) and the figure separates in grayscale | Type on texture, outlined type |
| V7 | White space and density | 6 | ≥ 25% calm field; front fact budget kept | Edge-to-edge facts |
| V8 | Color | 6 | One neutral, one accent, emotion matches the blocker | Rainbow, or a government palette |
| V9 | Type | 8 | One family, 3–6 word headline, readable measure and leading | Script headline, 9+ words |
| V10 | Photo art direction | 10 | One subject, right crop, gaze and light match the blocker | Stock tell, tiny framed box, sideways room |
| V11 | Offer architecture | 8 | One offer; numeral is the hero when a number exists; qualifier attached | Two prices, or “see back” |
| V12 | CTA lockup | 6 | One primary device, labeled code if present, phone at the print floor | Bare code, three phones, pill button |
| V13 | Trust and compliance | 6 | One subordinate line; no badge wall; no official-notice cues | Seals, fake deadline, missing proof on a trust sale |

The 1.6× offer-to-headline ratio is a house rule **[C]** on top of AF5 (offer ≥ 1.5× body, headline ≥ 2.5× body). They measure different pairs. A question-led card may keep the offer smaller than the headline. A numeral-led card may not.

## 6. Calibration from the corpus

Grades are in `analyses/`. Mailbox pieces (PM) are weighted above vendor samples (MMR). Brand-owned files are style reference only. Nothing here is permission to copy marks, lines, or pictures.

**A — one idea, nothing extra**

- **PM-047 (A).** Finished house, one savings lockup larger than the headline, one phone, proof on the back. This is the local-service target.
- **PM-022, PM-054, PM-046, PM-036, PM-052, MMR-397 (A−).** One card and one percent (PM-022). Product filling half the card and one badge, proof on the back (PM-054). One question and a footer phone (PM-046). Photo column, offer column, footer phone (PM-036). A ring and two lines of type (PM-052). One exterior and one next step (MMR-397). Each misses a clean A for one reason: no redemption on the face, a second perk, a silent front, or vendor/brand ownership.

**B — clear, one soft principle**

- **PM-010, PM-012, PM-041, PM-043, PM-049, MMR-574, MMR-019.** A real subject and a readable offer, plus one extra: a badge row, a second price, a shy phone, process photos with no result, a repeated price, or a shared vendor frame.
- **MMR-516, MMR-113, MMR-032.** Medicare calm: a person, paper, no official costume. Not an A, because the next step is softer than the portrait. MMR-032 and MMR-516 are not artwork sources (brand system, or a private sitter).

**C — the band we are leaving**

- **PM-015, PM-007, MMR-002, the later MMR-57x roofing tiles.** Readable coupons. Three prices, yellow headers, or a repeated tile frame. Competent. Not a target.
- **PM-025 (B−)** is the best HVAC piece in the mailbox and still splits the shout between header and phone. Use it as “almost” rather than as a template.

**D and F — do not average these in**

- **F: MMR-513, MMR-047, MMR-047-2.** Government-notice look and a fake deadline. Loud hierarchy does not help.
- **D: PM-011** (seals and a burst), **PM-017** (every device shouting), **PM-023** (catalog, offer deferred), **PM-027** (type and photo axes disagree, as the file reads), **PM-032** (yellow field, a slogan, no next step; may be an address face), **MMR-151** (door-hanger stack).

**Owner favorites.** PM-047, PM-054, PM-022, PM-056, and PM-057. Retrieval keeps these in the set. The critic uses them as calibration anchors. PM-056 is the Wondercide mosquito and tick postcard. Learn its discipline: a three-color palette (navy, lime, white), chunky condensed display type, a clean lifestyle photograph plus one product hero, a 2×2 icon benefit grid on the back, and one color-blocked offer panel with a pill-shaped code. PM-057 is the Dairy Queen cake coupon. Learn its simplicity: one hero product photo, a short playful headline, one big full-width offer strip, a barcode, and an expiry. Those are principles. They are not a layout to copy.

If Patrick disagrees with PM-047, PM-022, or PM-054 as the A examples, with PM-056 or PM-057 as a favorite, or with PM-011, MMR-513, and MMR-047 as the weak examples, change this table before tuning the weights. The playbook’s ratios stay until response data, not taste, moves them. The favorite list can also be set with `DESIGN_OWNER_FAVORITES`.

## 7. What the critic returns

The grade, the first broken rule (auto-fail first, then the lowest vision row), and one structural edit. “Delete the second price and enlarge the first” is an edit. “Nudge the logo” is not.

