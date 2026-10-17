# What will move the cards from a C to an A

Our generated postcards look like the average piece in a real mailbox: a yellow header, three prices, a stock photo, and a phone somewhere. The mailbox also contains a few cards that are obviously better. Those few are the target. This note is the short version. The rules live in `playbook/`. The grades live in `analyses/`.

## The 10 rules

1. **One thing on the front.** When you blur the card, one shape remains, and it carries about 35–50% of the punch. A photo can fill most of the card; the punch inside it is still one number, one face, or one product.
2. **If the offer is a number, the number is bigger than the headline.** At least 1.6 times the headline’s cap height. The headline stays at least 2.5 times the body. If the card is a question instead of a discount, the question is the big thing and the number stays second.
3. **Three type sizes on the front.** Display, support, and the phone. A logo is not a fourth headline. Script is for the logo only.
4. **The front is the interrupt. The back is the proof.** One offer on the front. Reviews, steps, and badges go on the back. The offer is not “see other side.”
5. **The photo is the work or the result, full bleed.** A roof, a pair of hands, a finished window, a real advisor. Not a family on a sofa in a small frame. Not lightning. Not six equal thumbnails.
6. **One way to respond, designed as a group.** A phone or a QR code leads. The other sits next to it, smaller, with a two-word label on the code. No pill button. No bare code in a corner.
7. **Leave a quarter of the card quiet.** Empty paper, sky, or a flat color. The front holds a headline, one offer, one response, and one trust line. That is the whole fact budget.
8. **One neutral, one accent.** The accent hits the offer or the phone, not both, and not a row of icons. No eagle, no “official notice,” no fake five-day deadline. A serious card can be calm without dressing up as the government.
9. **Say it in one glance.** In three seconds a stranger can name the trade, the offer, and what to do. If they remember a color and a logo, the card failed.
10. **Copy the move, not the brand.** The mailbox winners teach a structure. They do not donate their headlines, photos, logos, or phone numbers.

## Top 3 mailers

Patrick can agree or disagree. If he disagrees, we change the calibration table in the rubric before we change the rules.

1. **PM-047 — A.** A window-and-door card from the mailbox, both faces. The front is a finished house and one savings figure, larger than the headline, with one phone. The back repeats the phone and holds the license and the proof. It is the local-service pattern: result photo, one number, one response. Do not copy the brand, the amounts, or the pictures.
2. **PM-054 — A−.** A beauty card, both faces. The product (the hair) fills one half. One name, one circular discount on the seam, a dark quiet field. The back is a before-and-after and one code. It shows how a second face proves the first instead of starting a new ad. The shop line is quieter than it should be for a contractor, which is why it is an A− and not an A.
3. **PM-022 — A−.** A retail card. One white card sitting on a full-bleed photo, one percent inside it, larger than the sentence above it, about three type sizes. Figure and ground are instant. It misses an A because the front never says how to redeem. Add a phone or a labeled code inside that white card and the structure is complete.

Near misses worth knowing: **PM-046** (one question, a footer phone), **PM-036** (a patio photo, an offer column, a footer phone), **MMR-397** (one exterior, one next step; brand-owned, style reference only).

## Three of the weakest

1. **MMR-513 — F.** A Medicare piece designed to look like an enrollment notice, with a short response window. The type is loud. The costume is the failure. Hierarchy does not save it.
2. **MMR-047 — F.** A final-expense piece in the same official-notice costume, with a fake deadline. MMR-047-2 is the same idea. These are anti-examples, not craft samples.
3. **PM-011 — D.** A mailbox buying-event card. Gold, seals, and a burst, all at display size. There is no single thing to see and no clear next step. This is what “more emphasis” turns into.

Two mailbox files need Patrick’s call before they stay in the weak list. **PM-027** reads as a shutter interior printed sideways relative to the header; if he only turned the snapshot, the frame itself is fine and the grade should rise. **PM-032** is a yellow field and a diagonal slogan with no photo and no phone; if that photo is the address side, it should not be judged as a front.

## What phase 2 should build

Phase 1 does not touch the app.

1. **Art-director step.** Before layout, the model writes a Design Rationale that validates against `schemas/design-rationale.schema.json`. Focal element, eye path, grid, scale ratios, palette, type pairing, photo brief, offer treatment, density. Examples for roofing, plumbing, and Medicare are in `schemas/examples/`. They are built from the rules, not traced from a mailer.
2. **Grid-based composer.** It may only place elements on the grid and the ratios in that rationale. It does not invent a second offer, a second accent, or a fourth type size. Image models still only make the picture. They do not design the card.
3. **Critic loop.** Run the existing auto-fails (AF1–AF10), then the vision score in section 5 of the rubric. If it fails, return one structural edit and regenerate. Ship only at 0 auto-fails, D1–D6 at least 8.0, and the vision score at least 80.
4. **Benchmark set.** Score every new template against the analyses, with mailbox pieces weighted above the vendor samples. PM-047, PM-054, PM-022, and PM-056 are the owner's favorites and the critic's calibration anchors. PM-056 teaches a three-color palette, condensed display type, a lifestyle photograph plus a product hero, a 2×2 benefit grid, and one offer panel with a pill-shaped code. It does not teach its layout. MMR-513 and MMR-047 are the automatic failures. Do not train on the average C.
