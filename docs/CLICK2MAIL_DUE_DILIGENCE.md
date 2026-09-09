# Click2Mail Technical Due Diligence Report

**Status:** Research complete. Pre-architecture. No implementation decisions have been made from this document.
**Prepared for:** Modern Mail — evaluation of Click2Mail as the production/fulfillment partner referenced in `docs/PROJECT_BLUEPRINT.md` ("Immediate Next Milestone: Click2Mail Evaluation").
**Scope:** Product capabilities, API architecture, authentication, job lifecycle, production workflow, artwork requirements, template system, 5×8 postcard specifications, bleed/trim/safe areas, address/postage constraints, variable data support, batch processing, proof generation, pricing model, vendor limitations, open questions, risks, and architectural implications.
**Explicitly out of scope for this document:** integration code, API client design, data model design, or any implementation recommendation.

---

## 0. How to read this document

Every substantive claim below is tagged with one of five classifications, matching the standard requested for this research pass:

| Tag | Meaning |
|---|---|
| **[DOC]** | Confirmed by Click2Mail's own published documentation (developer portal, support KB, blog, or product pages) |
| **[STAFF]** | Confirmed directly by Click2Mail staff (email, call, chat) |
| **[INDUSTRY]** | Not Click2Mail-specific — standard practice across direct-mail/print vendors, stated here for context |
| **[ASSUMPTION]** | Inferred from patterns in the documentation but not explicitly stated for our exact case (e.g., extrapolated from a sibling product's example) |
| **[UNKNOWN]** | Not found anywhere in public documentation; needs direct clarification from Click2Mail |

**Important gap up front:** You asked me to incorporate "the information I previously shared from my email conversations with the Click2Mail team." I searched this Gmail account exhaustively (`click2mail`, `c2m`, `"click 2 mail"`, `postcard API`, `mail vendor`, and a broad `in:anywhere click2mail` sweep) and found **zero matching threads**. Nothing from Click2Mail staff exists in this mailbox. Every **[STAFF]**-eligible claim in this report is therefore absent — everything here comes from public documentation only. If those email conversations exist elsewhere (a different inbox, a shared doc, a Slack thread), please paste or forward the actual content and I will fold it in and re-tag the relevant sections as **[STAFF]**. Until then, treat every open question below as genuinely open.

---

## 1. Product capabilities

**[DOC]** Click2Mail is a print-and-mail fulfillment vendor operating three closely related access surfaces:

1. **Mailing Online Pro** — the web UI for manual campaign creation, templates, job configuration, and proofing.
2. **REST API ("MOLPro")** — the modern programmatic interface at `developers.click2mail.com`, built on a ReadMe.io-hosted reference (OpenAPI-backed) plus narrative guides.
3. **Batch/XML API** — a bulk, file-pair-based REST interface for high-volume paired PDF+address submissions (`click2mail.com/batch`).

**[DOC]** The product catalog spans far beyond postcards: postcards (6 sizes: 3.5×5, 4.25×6, 5×8, 6×9/6.5×9, 4×9, 6×11), notecards (4.25×5.5, standard and folded), rack cards (4×9), booklets (self-mailer and address-back/front variants, 8.5×11), letters (8.5×11, 8.5×14), flyers (8.5×11), secure self-mailers (8.5×11), reply mail (postcard and letter), certified mail (self-mailer and letter), Priority Mail / Priority Mail Express letters, brochures (11×8.5), EDDM mailers (multiple sizes), and shipped (non-mailed, printed-and-shipped-to-you) card stock. Modern Mail's near-term interest is the postcard family, but the vendor's breadth matters for the Blueprint's "Mail Format" recommendation logic — the vendor already supports more formats than `CreativeSpec.format` (currently `postcard_4x6` only) accounts for.

**[DOC]** Two fulfillment modes exist per product: **mailed** (Click2Mail executes postage and USPS induction on the customer's behalf) and **shipped** (Click2Mail prints and ships the physical stock to the customer's own address for the customer to distribute — no USPS mailing, no address list required, no personalization). These are materially different product codes/pricing and — per the 5×8-shipped product page — **shipped postcards do not support variable data / mail merge at all [DOC]**. This is a hard product-tier distinction Modern Mail needs to be deliberate about, since the Blueprint's "one-click production ordering" vision assumes the mailed path.

**[DOC]** Additional capabilities confirmed in documentation: USPS tracking (Intelligent Mail barcode / IMb) per mail piece via a `c2m_uniqueid` custom field, USPS Electronic Return Receipt, EDDM (Every Door Direct Mail — carrier-route-level bulk mail requiring no address list), address book management, CASS-standardized address correction, job templates (reusable print/mail configuration saved in the UI and invoked by name via the API), and a cost-estimate endpoint that mirrors the UI's own pricing calculator.

**[UNKNOWN]** Whether Click2Mail exposes any image-generation, AI-assisted design, or dynamic-imagery capability of their own (relevant only insofar as it might overlap or conflict with Modern Mail's own AI Creative Engine — Modern Mail should own all creative generation and hand Click2Mail only a finished, print-ready spec).

---

## 2. API architecture

**[DOC]** Click2Mail exposes (at least) three distinct protocol generations, which is itself an important architectural fact:

- **SOAP API** — referenced by name on the Batch/XML overview page ("two flavors of API protocol: SOAP and REST") but not otherwise documented on the modern developer portal. Presumed legacy/deprecated-in-emphasis. **[UNKNOWN]** whether it is still fully supported or actively discouraged for new integrations.
- **REST API (MOLPro)** — the current, actively documented surface. Base path pattern: `https://{env}-rest.click2mail.com/molpro/{resource}`, e.g. `https://stage-rest.click2mail.com/molpro/credit`. This is the surface Modern Mail should plan around.
- **Batch/XML API** — technically REST-transported ("standard HTTP GET, POST and PUT requests") but organized around paired XML manifest + PDF uploads rather than the discrete resource model of MOLPro REST. Positioned for high-volume/agency use cases (see §12, Batch processing).

**[DOC]** The REST API reference (`developers.click2mail.com/reference`) is organized into 9 resource categories with roughly 80 documented operations total:

| Category | Operation count | Examples |
|---|---|---|
| Jobs | ~29 | create, update, submit, cancel, duplicate, delete, proof create/get/accept, USPS tracking, EDDM sub-resources, cost, status |
| Documents | 10 | create, create-from-URL, merge, convert-to-PDF, check-name, get-variable-data, list versions, delete |
| Address Lists | 11 | create, add/update/delete addresses, list, retrieve contents, name validation, create-from-address-book |
| Account | 7 | addresses, CRID, account creation, authorization |
| Address Book | 6 | CRUD on saved address books |
| Address | 1 | delete single address |
| Address Correction | 1 | CASS validation |
| Credit | 2 | balance check, purchase |
| Cost Estimate | 1 | pre-job pricing |
| Projects | 3 | list, create, list jobs in project |

**[DOC]** All documented endpoints accept `application/json` or `application/xml` via an `accept` header, defaulting to JSON. Request bodies for most write operations are **query-string/form parameters**, not JSON bodies — e.g. `POST /jobs` takes `documentClass`, `layout`, `productionTime`, etc. as query parameters, not a JSON payload. This is notably un-RESTful by modern conventions and matters for how Modern Mail's server actions would construct requests.

**[DOC]** Two full environments exist with fully separate credentials and data: **staging** (`stage-rest.click2mail.com`, account created at `stage.click2mail.com`) and **production**. **[DOC]** "Each environment requires its own separate creds" — a staging account/credentials must be created independently of production; there is no shared login.

**[DOC]** Official SDKs exist in 8 languages/tooling forms: Python, PHP (5.6+ and legacy 5.5-), Ruby, Node.js, Java, VB.NET, C#.NET, and a Postman collection — hosted on Click2Mail's GitHub. **[UNKNOWN]** SDK maintenance cadence, version currency, or whether the Node.js SDK (most relevant to a Next.js/TypeScript codebase) is actively maintained versus a thin/stale wrapper. This should be verified before deciding whether to adopt an SDK or call the REST endpoints directly (as Modern Mail's own `AnthropicCreativeEngine` does with Anthropic's SDK).

**[DOC]** The docs site publishes an AI-agent-oriented index at `developers.click2mail.com/llms.txt` and supports a `.md` suffix on any documentation page for a raw Markdown version — useful for any future automated documentation ingestion, though this file itself was blocked by the site's Cloudflare protection during this research pass and could not be read directly (see §14, Risks).

**[UNKNOWN]** Formal rate limits / throttling policy. No published number found anywhere (support KB, developer docs, or general web search). Given `/jobs` (GET, listing) documentation itself warns to use `startDate`/`endDate` and `includeCost=false` "to prevent timeout issues" **[DOC]**, there is at least an implicit performance ceiling on unbounded queries, but no explicit requests-per-second or requests-per-day limit is documented anywhere I could find.

**[UNKNOWN]** Webhook / push-notification support for job status changes. Nothing in the reference categories suggests webhooks exist; status appears to be pull-only (`GET /jobs/{id}`, `GET /jobs` with filters). This has direct implications for how Modern Mail would track a launched campaign's status without polling.

---

## 3. Authentication

**[DOC]** Authentication is **HTTP Basic Auth** (`Authorization: Basic <base64(username:password)>`) using the customer's Click2Mail account username and password directly — not OAuth, not a separate API key/secret pair, not a bearer token.

**[DOC]** Confirmed explicitly by a support article: *"API keys are not required for REST or batch APIs"* — account credentials themselves are the only credential. This is a materially different (and materially weaker, by modern standards) auth model than Modern Mail's own Anthropic integration (bearer API key, no username/password coupling).

**[DOC]** Credential acquisition flow: create a **Business**-type account (staging first, then separately for production) → sign in → *My Account → Profile & Preference* → *API Access* section → "Start Now" → complete a short survey → credentials become the account's own login. Production access repeats the identical flow against a production account.

**[ASSUMPTION]** Because Basic Auth transmits the literal account password on every request, Click2Mail requires TLS on all endpoints (`https://stage-rest.click2mail.com`, presumably `https://rest.click2mail.com` in production) — this was not explicitly restated as a security guarantee anywhere, but is the only sane reading and is standard for any Basic-Auth API. **[INDUSTRY]** Storing a customer's actual mail-vendor account password (rather than a scoped, revocable API key) as a long-lived server secret is a materially higher-risk credential-storage posture than a typical API-key-based vendor integration, and increases blast radius if the secret leaks (an attacker gets full account control, not just API scope).

**[UNKNOWN]** Whether Click2Mail supports any scoped/limited-privilege credential (e.g., a sub-user or service account with restricted permissions) as an alternative to using the primary account's actual login. Nothing in the documentation suggests this exists — the "API Access" flow appears to activate API usage *on* the primary account, not create a separate principal.

**[UNKNOWN]** Credential rotation process, and what happens to in-flight jobs if a password is rotated mid-integration.

---

## 4. Job lifecycle

**[DOC]** Confirmed job status state machine (from Click2Mail support KB, stated as the REST-consumer-relevant status set):

```
EDITING → ORDER_SUBMITTED → ORDER_PROCESSING → AWAITING_PRODUCTION → IN_PRODUCTION → MAILED
                                                                                    ↘ ERROR (any point)
```

- **EDITING** — the status immediately after `POST /jobs` creates the job record; the job is still being assembled (document, address list, options) and has not been submitted for fulfillment. A job left in EDITING has **not** been paid for or committed.
- **ORDER_SUBMITTED** → **ORDER_PROCESSING** — transitional states entered by `POST /jobs/{id}/submit`.
- **AWAITING_PRODUCTION** — the "typical" resting state immediately after a successful submission, before the nightly (or, for expedited products, near-immediate) production cutoff is reached.
- **IN_PRODUCTION** — entered "sometime after 8 PM EST when the job is sent to the printer" for standard products, or within minutes for Priority/Express products **[DOC]**.
- **MAILED** — "after the mail has been handed off to USPS" **[DOC]**.
- **ERROR** — can occur at any point.

**[DOC]** The five-call happy-path documented end-to-end: `POST /credit/purchase` (fund the account) → `POST /documents` (upload creative) → `POST /addressLists` (upload/create recipient list) → `POST /jobs` (assemble document + address list + print/mail options into a job) → `POST /jobs/{id}/submit` (commit to production and pay). `GET /jobs/{id}` (or `GET /jobs` with filters) is the only documented mechanism to check status thereafter — **no webhook exists that I could find (see §2)**, so status must be polled.

**[DOC]** Payment happens **at submission**, not at job creation — `POST /jobs/{id}/submit` requires a `billingType` (Credit Card, Invoice, ACH, User Credit, Apple Pay, Google Pay) and, for card payment, full card details as query parameters on that same call. A job sitting in EDITING costs nothing and commits nothing.

**[DOC]** Documented recovery path for **insufficient funds**: if `/jobs/{id}/submit` fails for insufficient funds, the *same job* survives in a resubmittable state — the customer/integration adds funds and calls `/jobs/{id}/submit` again on the identical job ID. Unsubmitted jobs (stuck in EDITING) are discoverable via `GET /jobs` filtered by `jobStatus=EDITING`.

**[DOC]** Post-submission mutability: `POST /jobs/{id}/duplicate` (clone a job), `POST /jobs/cancelSubmittedJob` (cancel — presumably time-windowed, since production begins nightly; **[UNKNOWN]** exact cutoff/cancellation window relative to the production cutoff), `DELETE`/`POST /jobs/{id}` for delete of an unsubmitted job, `POST /jobs/{id}/addToCart` as an alternative to immediate submission.

**[UNKNOWN]** Exact meaning and cause set for `ERROR` status — the KB article names the status but doesn't enumerate what production-side failures land a job there (address undeliverable after acceptance? printer fault? payment reversal post-production-start?) or whether/how Modern Mail would be notified.

**[UNKNOWN]** Whether `AWAITING_PRODUCTION → IN_PRODUCTION` is genuinely a hard nightly-batch cutoff for *all* non-expedited products, or varies by product/facility. The 8 PM ET cutoff is documented for First-Class mail specifically **[DOC]**; whether every postcard product shares that exact cutoff needs confirmation.

---

## 5. Production workflow

**[DOC]** End-to-end pipeline, synthesized from the "Your First Mail Job," "Create a Job," job-status, and product-page documentation:

```
Fund account (credit)
        ↓
Upload/create document (creative)
        ↓
Upload/create address list (recipients)
        ↓ [optional] Address Correction (CASS) — can be run standalone before job creation
        ↓
Create job (bind document + address list + print/mail options)  →  EDITING
        ↓
[optional] Create Proof → review/accept proof
        ↓
Submit job (+ payment)  →  ORDER_SUBMITTED → ORDER_PROCESSING → AWAITING_PRODUCTION
        ↓
Nightly (or expedited) production cutoff
        ↓
IN_PRODUCTION  (printed, folded/trimmed, addressed, barcoded)
        ↓
MAILED  (handed to USPS)
        ↓
[optional] USPS Tracking / Electronic Return Receipt polling, keyed by c2m_uniqueid for multi-recipient jobs
```

**[DOC]** Turnaround options are a first-class product parameter (`productionTime`), not a fixed vendor SLA: **Next Day** (order by 8 PM ET), **3-Day**, and **"Select a Mailing Week"** (schedule up to 12 weeks ahead) were confirmed for the postcard line specifically. Priority Mail Express has its own same-day cutoff (10 AM ET).

**[DOC]** Delivery time (post-mailing, USPS transit) is explicitly *not* guaranteed: "3 to 30 days" with "no guaranteed service standards" for standard postcard mail, and Next-Day *production* is only available to "major metropolitan areas," with a stated 2–3 day guarantee for other destinations. This is a meaningful gap between "we produced/mailed it fast" and "the recipient received it fast" that Modern Mail's Campaign Confidence / Mail Status UI would need to represent honestly (per the AI System's non-negotiable against false certainty).

**[DOC]** A satisfaction guarantee exists for print/production quality specifically ("reprints, store credits or full refunds of production cost... for unsatisfactory work") — this is a production-defect guarantee, not a response-rate or delivery-time guarantee.

**[DOC]** Live operational status is published at `status.click2mail.com`, tracking REST API, Batch API, Website, Mailing Online Pro, MailJack+, Hub, Email to Mail, Click2EDDM, Easy Letter Sender, Mail my PDF, and Mail Delivery as separately monitored components, plus infrastructure (USPS, and Cloudflare's Ashburn/IAD region). At the time of this research, all components showed "All Systems Operational," REST API and Batch API both at 100.0% uptime over the trailing 90 days, and a single recent incident (a ~1h43m website outage, Aug 27–28, 2026) — this status page is a usable input to future vendor-reliability monitoring or an SLA discussion.

**[UNKNOWN]** Whether the vendor publishes (even privately, to enterprise customers) any formal SLA / uptime commitment / financial remedy for missed production windows, beyond the informal "guarantee" language on the product page. This is a contract question, not a documentation question, and is a natural item for direct outreach to Click2Mail.

---

## 6. Artwork requirements

**[DOC]** Accepted document formats for `POST /documents`: **PDF, DOC, DOCX, PUB, PPT, PPTX, PNG, JPEG, ODT**. A separate `POST /documents/wordtopdf`-style conversion endpoint (`Convert Document`) explicitly converts DOC/DOCX/PUB/PPT/PPTX/PNG/JPEG/ODT → PDF, implying PDF is the canonical internal format regardless of upload type. **[ASSUMPTION]** For a product like Modern Mail generating creative programmatically, submitting print-ready PDF directly (rather than relying on Click2Mail's DOCX/PPT conversion path) is almost certainly the safer, more literal, more predictable choice — but this is an implication to weigh later, not a decision made here.

**[DOC]** `POST /documents` requires `documentName`, `documentFormat`, `documentClass`, and the binary `file`. **`documentClass` is the field that ties an uploaded document to a specific physical product spec** (e.g., `"Letter 8.5 x 11"`, and by direct extrapolation `"Postcard 4.25 x 6"`, `"Postcard 5 x 8"`) — i.e., the document upload itself is already product-typed, not a generic blob later assigned a size at job-creation time.

**[DOC]** Documented upload-time validation failure modes (HTTP 400, distinct status codes): duplicate document, **document dimensions outside of range** (i.e., page size mismatch against the declared `documentClass`), page-count exception, "could not render document," and a distinct "preflight exception" status. This confirms Click2Mail runs real preflight validation (not just a format check) at upload time and will reject artwork that doesn't match the declared product's physical dimensions.

**[DOC]** Page-count ceilings are documented per multi-page product (letters, booklets, flyers) — e.g. Letter 8.5×11 up to 47 single-sided/94 double-sided pages (Flat Envelope required above 5/10 pages), Booklet 8.5×11 up to 56 double-sided pages. **Postcards are inherently single-page/single-sheet products and are not part of this page-limit table** — not a documented constraint for our use case.

**[UNKNOWN]** Maximum upload file size in bytes/MB for `POST /documents`. Not stated anywhere in the developer docs or support KB found. A tangential FTP-upload workflow (for the separate Mailing Online Pro list-upload feature, not document upload) references a 10 MB rule of thumb, but that is a different feature (address-list files) and should not be assumed to apply to document/PDF upload.

**[DOC]** General print-production guidance published in Click2Mail's own blog ("Direct Mail Design Specs Checklist"), stated as universal across mail formats:

- **Resolution:** minimum 300 DPI at final print size.
- **Color mode:** CMYK required; RGB submissions will shift/convert unpredictably at print time — "submit files in CMYK, not RGB."
- **File format:** PDF is "the standard for print submission"; flatten all layers, embed all fonts, outline text set in custom/non-standard typefaces.

**[UNKNOWN]** Exact accepted PDF/X conformance level (if any), ICC profile expectations, or whether Click2Mail's system performs any RGB→CMYK conversion automatically versus rejecting/warning on RGB input. The blog copy implies "don't submit RGB" as a best-practice instruction to the *designer*, not a stated system-level validation/rejection rule — worth confirming directly, since Modern Mail's `PostcardPreview` template system currently renders in CSS/hex-color space (effectively RGB) and would need a defined conversion step before print submission regardless of the answer.

---

## 7. Template system

**[DOC]** Click2Mail publishes two parallel template resources:

1. **`click2mail.com/c2m-templates`** — a marketing/navigation hub linking out to per-product template pages across the full catalog (postcards at 6 sizes, notecards, rack cards, booklets, letters, flyers, secure mailers, reply mail, certified mail, Priority products, brochures, EDDM mailers, card stock).
2. **`templates.click2mail.com/postcards/{size}`** (e.g. `/postcards/5x8`) — per-size download pages offering ready-made layout files for common desktop design applications: **Microsoft Word, Adobe InDesign, Apple Pages, Microsoft Publisher**. For the 5×8 postcard specifically, **two template variants are offered: Single Sided Postcard and Double Sided Postcard** — matching the `layout` enum pattern seen elsewhere in the API (`"Double Sided Postcard"` confirmed as a literal `layout` value for the 4.25×6 postcard product).

**[DOC]** The template pages themselves state their purpose plainly: "These templates are setup for the correct size, orientation and masking to ensure compatibility with our system" — i.e., they are pre-built design-app files (not a spec sheet with numeric callouts) meant for a human designer working in Word/InDesign/Pages/Publisher. They were not retrievable as text-extractable numeric specifications during this research pass (see §14, Risks) — the actual bleed/trim/safe-area *numbers* used in this report (§8) come from Click2Mail's separately published design-specs blog post, which states it applies generally across their mail formats, not from a 5×8-specific spec sheet.

**[ASSUMPTION]** Because Modern Mail does not use a desktop design application — creative is generated programmatically as a `CreativeSpec` and rendered via `PostcardPreview`'s own layout-variant templates — the Word/InDesign/Pages/Publisher template files themselves are not directly consumable by Modern Mail's pipeline. What Modern Mail actually needs from Click2Mail is the **numeric specification** (trim size, bleed, safe area, resolution, color space, address-panel geometry) so its own template renderer can produce PDFs that pass Click2Mail's preflight — not the design-app files. This reframes "get the templates" as "get the spec sheet," which is a distinct ask worth making directly of Click2Mail (see §15, Open Questions).

**[DOC]** Job Templates (a *different* concept from design/layout templates — this is a **job-configuration** template, saved via the Mailing Online Pro UI) let an account pre-configure product/print/mail options (and optionally a bound document and/or mailing list) once, then invoke `POST /jobs/jobTemplate?templateName=...` repeatedly via the API to spin up new jobs with identical configuration. This is the documented mechanism the mail-merge quick-start guide builds on (§10). It is UI-authored, not API-authored — there is no documented endpoint to *create or edit* a job template via the API, only to *invoke* one.

**[UNKNOWN]** Whether job templates can be created/updated/deleted programmatically, or are permanently a UI-only construct. If UI-only, Modern Mail would need a one-time manual setup step per document class it intends to support, or would bypass job templates entirely and always assemble jobs from scratch via `POST /jobs`.

---

## 8. 5×8 postcard specifications

**[DOC]** Confirmed baseline facts for the 5×8 postcard product specifically:

- **Physical size:** 5 × 8 inches, described by Click2Mail as "oversized" relative to their smaller postcard formats.
- **Sides:** available single-sided or double-sided ("single-sided for a bold splash or double-sided for more detail").
- **Coating/paper:** uncoated, or UV coating ("smooth, glossy, protective finish" — UV limited to full-color jobs).
- **Full bleed:** "your card will be printed and trimmed to show color to the very edge with no white border" — i.e., full bleed is the default expected design, not an optional upsell.
- **No-bleed alternative:** if a customer does *not* want full bleed, Click2Mail's own guidance is to leave a **1/8″ border** around text/images instead — this is stated specifically in the context of the no-bleed option, distinct from the bleed-extension number below.
- **Mailed pricing (base rate):** starts at $0.54/postcard, with volume breaks to $0.933, $0.824, $0.758, and $0.728 per piece at 500 / 5,000 / 50,000 / 250,000+ quantities respectively (note: the $0.54 "starting at" figure and the volume-tier figures as scraped do not form a strictly monotonic curve at face value — likely because the "starting at" figure reflects a different base configuration (e.g., single-sided, no coating) than the volume-discount tiers (likely double-sided/coated); **[ASSUMPTION]** this is a common vendor pricing-page pattern, not a data error, but the exact rate card by configuration needs direct confirmation rather than inference).
- **Postage (mailed, First-Class):** $0.495/piece, itemized separately from print cost.
- **Shipped (non-mailed) pricing:** starts at $0.12/unit at 1,000 minimum quantity, down to $0.233/unit is *actually the 25,000-qty rate in the scraped table* — i.e., volume pricing for the shipped SKU ranges roughly $0.389 (1,000 qty) down to $0.233 (25,000 qty). **Shipped 5×8 does not support mail merge/personalization** and does not qualify for international mailing (moot, since it isn't mailed by Click2Mail at all).
- **Production windows:** Next Day (order by 8 PM ET) or 3-Day; "Select a Mailing Week" scheduling up to 12 weeks out was confirmed for the postcard line generally.
- **Marketing Mail restriction:** postcards used for Marketing Mail class cannot include certain personal information, per cited USPS Domestic Mail Manual §243.2.0 — a compliance constraint on *content*, independent of layout.

**[UNKNOWN — the actual gap]** The **numeric bleed/trim/safe-area/resolution/color values specific to the 5×8 product page or template** were not retrievable as text during this research pass; the template page rendered without exposing those numbers to text extraction (see §14). The numeric values used throughout §9 below come from Click2Mail's *general* direct-mail design-specs blog post, which states it applies "across USPS-compatible mailpieces" broadly — reasonable to treat as the vendor's standing design guidance, but **not confirmed as 5×8-specific** and not sourced from an authoritative spec sheet with a version/date. This is the single highest-priority open item before any template rendering work begins (see §15).

**[ASSUMPTION]** Following the exact naming pattern confirmed for the 4.25×6 postcard (`documentClass: "Postcard 4.25 x 6"`, `layout: "Double Sided Postcard"`), the 5×8 product's API identifiers are almost certainly `documentClass: "Postcard 5 x 8"` with `layout` values `"Single Sided Postcard"` / `"Double Sided Postcard"` — consistent with the two template variants confirmed on the 5×8 template page. This is a strong inference from a consistent, confirmed naming convention elsewhere in the same system, but it is still an assumption until confirmed against the live `documentClass`/`layout` enum (which the API reference does not enumerate in text — see §7 and §15).

---

## 9. Bleed, trim, safe areas

**[DOC — sourced from Click2Mail's general design-specs guidance, not a 5×8-specific sheet; see caveat in §8]**

| Zone | Spec |
|---|---|
| **Bleed** | Extend background colors/images **1/8″ (0.125″) beyond the trim edge** on all sides. |
| **Safe area / live area** | Keep all critical content (text, logos, CTAs) **at least 1/8″ to 1/4″ inside the trim edge**. |
| **No-bleed alternative** (5×8-specific, from the product/template page) | If not bleeding to the edge, leave a **1/8″ border** around text/images instead. |
| **Resolution** | Minimum **300 DPI** at final print size. |
| **Color mode** | **CMYK** required; RGB "will shift... sometimes significantly" if submitted. |
| **File format** | **PDF**, flattened, fonts embedded/outlined. |

**[DOC]** Address-side (back, for a mailed piece) geometry, again sourced from the general design-specs guidance rather than a 5×8-specific sheet:

| Element | Spec |
|---|---|
| **Delivery address placement** | Lower-right portion of the address side, within USPS's OCR read zone. |
| **Address/barcode clear zone** | At least **5/8″ from the bottom edge** and **4.5″ from the right edge** must be free of ink/images/background. |
| **IMb barcode clear strip** | Bottom **5/8″** strip must be free of design elements. |
| **Return address** | Upper-left of the address side; separately, a 5×8-specific product note says **1/4″ from the top-left corner** if included. |
| **Postage/indicia area** | Reserve the **upper right** of the address side; no design elements should overlap. |
| **Ink coverage (address/barcode zone)** | **No more than 7%** ink coverage, to keep the zone machine-scannable. |

**[DOC]** IMb-specific geometry (from a separate search-result synthesis of Click2Mail's own guidance, consistent with the table above): the Intelligent Mail barcode is roughly **3″ × 5/8″**, and *can* live inside the address block itself if the address area has **at least 3.5″ of horizontal space**; otherwise Click2Mail places it across the bottom, toward the right, and reserves a **3/4″ × 4-7/8″ zone in the lower-right corner** for it.

**[INDUSTRY]** 1/8″ bleed and a similarly-sized safe margin are standard across the commercial print industry generally (this specific pairing is not unique to Click2Mail) — cited here for context, not as a Click2Mail-specific claim.

**[UNKNOWN]** Whether these numbers are literally identical for the 5×8 format specifically, or whether larger "oversized" formats like 5×8 use a different (e.g., proportionally larger) bleed/safe-area convention the way some print vendors scale margins with sheet size. Needs direct confirmation against the actual 5×8 template/spec sheet, not the general blog post.

**[UNKNOWN]** Exact required trim tolerance (± how many thousandths of an inch the physical cutter is expected to vary) — relevant to how conservative Modern Mail's safe-area rendering should be beyond the stated 1/8″–1/4″ figure.

---

## 10. Address / postage constraints

**[DOC]** Address lists are Click2Mail's atomic recipient unit — "an address list may consist of a single address, or an arbitrarily large number of addresses, but actions are always taken on a list as a whole." A job always references an address-list ID (or a single-address submission via a distinct "Submit Single Piece Job" endpoint), never ad hoc inline recipients.

**[DOC]** Two documented address-mapping schemas (`addressMappingId`) exist for `POST /addressLists`:
- **Mapping ID 1:** `Firstname, Lastname, Organization, Address1, Address2, Address3, City, State, Postalcode, Country`
- **Mapping ID 2:** `First_name, Last_name, organization, Address1, Address2, City, State, Zip, Country_non-US`

Custom mappings are also supported (the mail-merge workflow explicitly builds a custom CSV schema and maps it through the UI to obtain a mapping ID), so these two are defaults/conveniences, not an exhaustive list.

**[DOC]** Address list processing status codes (`GET /addressLists/{id}` polling target): **0 = Uploaded/Created → 1 = Mapped → 3 = CASS Standardized (ready for use in jobs)** per the REST reference; however, the separate legacy quick-start guide instructs polling **until status 5** for the same "ready" condition. **This is an unresolved discrepancy between two Click2Mail-authored sources** — flagged explicitly as needing clarification (§15) rather than silently reconciled.

**[DOC]** **CASS standardization runs automatically** as part of address-list processing — this is USPS's Coding Accuracy Support System, which validates and standardizes US addresses to a certifiable, deliverable format. A separate, synchronous **Address Correction** endpoint (`POST /addressCorrection`) exists specifically so a retail/customer-facing website can validate an address interactively *before* committing it to an order — described explicitly as being for that use case ("allows the retail website to validate the address interactively... prior to submitting the order"), and documented as **US addresses only**.

**[UNKNOWN]** Whether Click2Mail's address processing includes **NCOA (National Change of Address)** — i.e., automatically catching and correcting for recipients who have moved — which is standard in higher-end direct-mail platforms and was named explicitly in `docs/PROJECT_BLUEPRINT.md`'s own list of things a production vendor should be evaluated on. Not found in any documentation reviewed. This is a direct, high-value question for Click2Mail.

**[DOC]** Postage/mail-class is a job-level parameter (`mailClass`, e.g. `"First Class"`), separate from and overriding a product's own default (documented as overriding "the default of First Class for mailed" products where applicable) — implying different postcard products may default to different mail classes (e.g., Marketing Mail vs. First-Class) and this is explicitly overridable per job.

**[DOC]** International mail is a distinct, separately priced axis: `POST /costEstimate` accepts `internationalQuantity` and `nonStandardQuantity` as separate counters from the base `quantity`, implying non-US and non-standard-format addresses are priced and possibly processed differently than domestic standard addresses within the *same* job. **[UNKNOWN]** the exact definition of "non-standard" address in this context (PO boxes? APO/FPO? irregular formatting that fails CASS?).

**[DOC]** Marketing Mail-class postcards are restricted from including certain personal information per USPS DMM §243.2.0 (cited directly on the 5×8 product page) — a content-compliance rule Modern Mail's creative generation would eventually need to be aware of if a campaign is priced/routed as Marketing Mail rather than First-Class.

**[UNKNOWN]** Full EDDM constraint set (route/post-office selection mechanics, minimum piece counts, saturation-mail design rules) — the API confirms EDDM is a first-class job type with its own sub-resources (route, post office, mailer info) but the actual rules governing EDDM eligibility/design were not deeply explored in this pass, since Modern Mail's Blueprint centers on targeted/list-based audiences rather than EDDM's blanket carrier-route model. Worth a dedicated follow-up if EDDM becomes relevant to the Audience pillar.

---

## 11. Variable data support

**[DOC]** Click2Mail's variable data / mail merge is a **hybrid UI+API workflow**, not a pure-API capability — this is one of the most architecturally significant findings in this research.

The documented end-to-end process:

1. **(UI)** Build a CSV with alphanumeric-only column headers (underscores allowed; no spaces or special characters).
2. **(UI)** Upload the CSV under Mailing Lists; map its headers, obtaining a mapping ID.
3. **(UI)** Create a new document in the web editor, associate the mailing list, then **manually insert merge fields by clicking an underlined "{M" control inside text boxes** — i.e., merge-field placement is a point-and-click authoring action inside Click2Mail's own web design tool, not a token/placeholder syntax embeddable in an uploaded PDF.
4. **(UI)** Save the document; create a matching Job Template (matching page size, deliberately *not* including the mailing list in the template).
5. **(API)** `POST /jobs/jobTemplate?templateName=...` → creates a job from the template.
6. **(API)** `POST /addressLists` with the mapping ID and per-recipient merge-field values in the address XML.
7. **(API)** `POST /jobs/{id}` (update) to bind the new address list to the job.
8. **(API)** `POST /jobs/{id}/submit`.

**[DOC]** This means: **a mail-merge-capable document must be authored once, by hand, inside Click2Mail's own web editor** — merge fields cannot simply be embedded as text tokens in a PDF uploaded via `POST /documents`. Once that document+template pair exists, subsequent *campaigns* using the same layout can be driven entirely via API (new address list in, new job out) — but the layout itself, and which fields are merge-capable, are fixed at UI-authoring time.

**[DOC]** A read endpoint, `GET /documents/variableData/{id}`, exists to retrieve which merge fields are configured on an already-authored document — implying an integration can at least *introspect* an existing template's merge fields programmatically, even though it cannot *create* them programmatically.

**[UNKNOWN]** Whether any newer/alternate API path bypasses the UI-authoring requirement (e.g., a way to declare merge-field regions on an uploaded PDF directly). Nothing in the current reference categories suggests one exists; this should be asked directly rather than assumed absent.

**[UNKNOWN]** Maximum number of merge fields per document, maximum recipients per merge job, whether merge fields can gate *conditional* content (show/hide a block based on a field value) versus pure text substitution, and whether images (not just text) can be merge-variable. None of these were documented in the sources reviewed.

**[DOC]** The 5×8 shipped (non-mailed) postcard product explicitly **does not support personalization/mail merge at all** — a hard product-tier restriction, not a general limitation of the format.

---

## 12. Batch processing

**[DOC]** "Batch processing" in Click2Mail's vocabulary refers specifically to the **Batch/XML API** (`click2mail.com/batch`), a distinct integration surface from the MOLPro REST API's single-job-at-a-time model — described as letting a customer "group all your mailings and send them to us in one API call instead of sending the files one at a time," combining "multiple documents and print products" in a single submission.

**[DOC]** Two submission shapes are supported: **one-to-one pairing** (each recipient address paired with its own individual PDF — i.e., pre-personalized documents generated externally, one per recipient) or **one-to-many** (a single address array plus a single shared PDF, for a non-personalized blast to many recipients). This is notable: the **one-to-one pairing mode is effectively Click2Mail's answer to "server-side-generated variable data"** — if Modern Mail generated a distinct, fully-rendered PDF per recipient itself (rather than relying on Click2Mail's UI merge-field mechanism from §11), the Batch/XML API's one-to-one mode is the documented path to submit that as a single mailing, rather than looping individual `POST /jobs` calls per recipient through the standard REST API.

**[DOC]** A getting-started guide exists at `click2mail.com/batch-xml/molpro/getting-started/main` (referenced from the Batch overview page) and a supported-products list exists on a linked sub-page; neither was deep-crawled in this pass (time-boxed toward the postcard/spec priorities) and should be revisited before any batch-path architecture decision.

**[UNKNOWN]** Whether the Batch/XML API requires a separate account tier, contract, or approval from Click2Mail (several vendors gate bulk/batch access behind a sales conversation) — not stated in anything reviewed. Given the "requires a simple REST interface" framing it *reads* as self-serve, but this is inference, not confirmation.

**[UNKNOWN]** Batch size ceilings (max recipients per batch call, max total payload size), batch-level error semantics (does one bad address/PDF pair fail the whole batch or just that piece?), and batch-level status/proofing model (is there a single job ID for the whole batch, or per-recipient sub-jobs?).

---

## 13. Proof generation

**[DOC]** Proofing is modeled as a job sub-resource, not a separate top-level object:

- `POST /jobs/{id}/proof` — **Create a Proof**. Explicitly documented as "an optional API that is mainly used by our customers that use our APIs for fulfilment on their retail web site." For multi-recipient jobs, the proof shows **first, middle, and last** documents in the run (i.e., a representative sample across the merge/variable-data range, not just piece #1) — a meaningful detail for variable-data QA.
- `GET /jobs/{id}/proof/{proofId}/{sessionId}` — **Return a Proof**. Retrieves the rendered proof artifact, keyed by both a proof ID and a session ID (both presumably returned from the create-proof call, though the exact response payload shape was not text-extractable from the reference page during this pass).
- `POST /jobs/{id}/proof/accept` (with an `acceptId` parameter) — **Accept a Proof**. Documented purpose is explicitly an *audit trail* mechanism — "the customer looked at the proof of mailing and said it was good" — for integrators who resell fulfillment on their own retail site and need to prove customer sign-off occurred.

**[DOC]** Proofing is explicitly framed as **optional** in the standard job flow — a job can be submitted without ever calling the proof endpoints. This matters directly for Modern Mail: the Blueprint's "Order Campaign" one-click vision and the Product Bible's "customer must explicitly approve the final creative before... launch" principle are already satisfied *inside* Modern Mail's own Creative Studio approval flow (§ per `docs/prd/CreativeStudio.md`) before a job would ever reach Click2Mail — so Click2Mail's proof/accept mechanism reads as redundant with Modern Mail's own approval step for the *creative* itself, and more relevant as a **print-production sanity check** (does the vendor's actual print rendering match what Modern Mail's `PostcardPreview` showed the customer?) than as a second customer-facing approval gate.

**[UNKNOWN]** Turnaround time to generate a proof after `POST /jobs/{id}/proof` (synchronous return, or a poll-until-ready pattern like address-list CASS processing?). Not stated.

**[UNKNOWN]** Whether accepting (or *not* accepting) a proof has any effect on the job's ability to proceed to `submit` — i.e., is proof acceptance ever a hard gate the production system enforces, or purely an advisory audit-trail record with no enforcement? The documentation's framing ("mainly used by... customers that use our APIs for fulfilment on their retail web site") suggests the latter (advisory, for the *integrator's own* liability/audit purposes) but this isn't stated definitively.

---

## 14. Vendor limitations (documentation-access and platform-level)

This section captures limitations discovered in the *process* of researching Click2Mail, not just the product — several are directly relevant to how confidently Modern Mail can rely on public documentation going forward.

**[DOC/observed directly]** `click2mail.com`, `developers.click2mail.com`, `templates.click2mail.com`, and `support.click2mail.com` all return **HTTP 403 (Cloudflare-fronted block)** to standard automated fetch tools, including this session's direct web-fetch tool and even a text-extraction proxy for at least one path (`llms.txt` specifically was blocked even through a proxy that successfully read dozens of other pages on the same domains). Nearly all of this report's findings were obtained by that proxy successfully rendering pages that were otherwise blocked — meaning the underlying content is real and was genuinely read, but the site's own bot-defense posture is aggressive enough that **any future automated re-verification of this documentation (e.g., a scheduled doc-drift check) cannot assume straightforward programmatic access** and would need a comparable workaround or an authenticated/allowlisted path.

**[DOC/observed directly]** Several individual API reference pages, notably the postcard/product **enum value lists** (the actual complete set of valid `documentClass`, `layout`, `envelope`, `color`, `paperType`, `printOption` strings), are **not present anywhere in static documentation text** — Click2Mail's own support article on this exact topic ("Get Product Parameters," article #74) resolves to *"watch a video"* (a Loom link) rather than a written enumeration. This is a real, confirmed vendor documentation gap, not a research shortfall on our side: **the authoritative list of valid product-configuration values apparently only exists inside the Mailing Online Pro web UI's own dropdowns (and/or the interactive "Try It" panel on each reference page, which requires a live authenticated session to populate), not in any static reference.**

**[DOC]** A **naming-convention quirk is permanently baked into the API** for backward-compatibility reasons: `documentClass: "Priority Express Letter 8.5 x 11"` contains a stray extra space, which Click2Mail has explicitly stated it cannot remove because existing integrators already depend on the exact string. This is worth internalizing as a general pattern: **`documentClass`/`layout` values are treated as literal, un-versioned, occasionally-inconsistent strings**, not a clean enum — any future Modern Mail integration should expect to hardcode/verify exact strings against a live account rather than assume a clean naming convention, and should not assume string values are stable in the abstract (only that specific, already-adopted strings won't be changed out from under existing users).

**[DOC]** Documentation is spread across **at least four separate content systems** with inconsistent depth and occasional contradiction: the ReadMe.io-hosted developer portal (`developers.click2mail.com`, current, most authoritative), a legacy REST doc site (`rest.click2mail.com`, still live and still linked from search results, appears to predate the ReadMe.io migration), a support/help-desk KB (`support.click2mail.com`, mix of substantive articles and stub/placeholder articles — several articles reviewed in this pass were effectively empty), and a marketing blog (`blog.click2mail.com`, which turned out to hold some of the *only* numeric design-spec content found, despite not being "documentation" in a formal sense). The address-list "ready" status-code discrepancy in §10 (3 vs. 5) is a direct, confirmed example of cross-source inconsistency, not a hypothetical risk.

**[UNKNOWN]** Company scale, financial stability, or long-term viability signals (Click2Mail is a long-established brand and the status page reflects healthy day-to-day operations, but nothing in this research pass constitutes vendor financial/business-continuity due diligence — that is a separate research track from technical due diligence and wasn't in scope).

---

## 15. Open questions (prioritized — for direct outreach to Click2Mail)

These are the items that materially block confident architecture decisions and were not resolvable from public documentation:

1. **5×8-specific numeric spec sheet.** Get the actual bleed/trim/safe-area/resolution/color numbers *for the 5×8 postcard product specifically* (not the general blog post used as a stand-in in §9), ideally as a PDF or written spec rather than a design-app template file, since Modern Mail's renderer is not a desktop design tool.
2. **Complete, authoritative `documentClass`/`layout`/`envelope`/`color`/`paperType`/`printOption` enum values**, especially confirming the exact literal strings for 5×8 postcard (`"Postcard 5 x 8"` and its `layout` values are our best inference, not a confirmed string) and however many other product types the Blueprint's roadmap might eventually touch. This apparently requires either a live authenticated "Try It" session, UI inspection, or asking Click2Mail directly for a written enumeration.
3. **Reconcile the address-list "ready" status code discrepancy** (documented as `3` in the current REST reference, `5` in the legacy quick-start guide) — needs a definitive answer on which is current/correct.
4. **Whether merge-field/variable-data document authoring can happen via API at all**, or is permanently a manual, one-time UI step per layout. This is the single biggest constraint on any "fully automated, AI-generated-creative-to-mailbox" pipeline, since it currently implies a human must open Click2Mail's web editor and manually place merge tokens before any AI-generated *design* can carry AI-generated *per-recipient personalization* through Click2Mail specifically (as opposed to Modern Mail pre-rendering fully personalized PDFs itself and using the Batch/XML API's one-to-one pairing mode instead — see §12).
5. **Formal rate limits**, and whether they differ between staging and production.
6. **Whether webhooks or any push-notification mechanism exists** for job-status changes, or whether polling `GET /jobs/{id}` is genuinely the only option.
7. **NCOA support** (move-detection/correction), separate from and in addition to CASS standardization — named explicitly as a desired capability in `docs/PROJECT_BLUEPRINT.md`'s own Data Axle/audience section and not found documented anywhere on the print/mail side.
8. **Batch/XML API access requirements** — self-serve or gated behind a sales/contract conversation, and its size/error-handling ceilings.
9. **Maximum document upload file size** for `POST /documents`.
10. **Formal SLA / uptime or production-window commitments** beyond the informal product-page "guarantee" language, and what recourse exists if a committed production window is missed.
11. **Scoped/limited-privilege credentials** — whether any alternative to using the primary account's actual login/password exists for server-to-server integration (see §3).
12. **Proof turnaround time and whether proof acceptance is ever an enforced gate**, or purely advisory/audit-trail.
13. **The actual content of your prior email exchange with the Click2Mail team**, which I could not locate anywhere in this Gmail account (see the note at the top of this document) — please share it directly so it can be folded into this report and any claim it confirms can be re-tagged **[STAFF]**.

---

## 16. Risks

**Documentation/vendor-integrity risks**

- **Undocumented enum values (§14).** Any integration will need a verification step against a live account before the first real job is created, and periodically thereafter, since these values live in UI dropdowns rather than versioned documentation. Building against a guessed/inferred string (as this report necessarily does for `"Postcard 5 x 8"`) risks a runtime `400` at job-creation time if the guess is wrong.
- **Cross-source contradiction (§10, §14).** The demonstrated existence of at least one direct factual contradiction between two Click2Mail-authored sources (status code 3 vs. 5) means no single Click2Mail page should be treated as unconditionally authoritative without cross-checking, and any future doc-drift monitoring needs to account for multiple, inconsistently-maintained content systems.
- **Aggressive bot-defense on Click2Mail's own docs (§14).** Automated/scheduled re-verification of vendor documentation (a reasonable thing to want for a production dependency) is not straightforward against this vendor's site as configured; a stale local copy of key specs (this document) is more load-bearing than it would be for a more automation-friendly vendor.

**Architecture-shape risks**

- **Basic Auth against the literal account password (§3)** is a meaningfully worse credential-storage posture than a scoped API key, and a leaked/misconfigured secret has full-account blast radius, not scoped-API blast radius. This is a security-review item independent of any specific implementation.
- **Variable data is UI-authored, not API-authored (§11).** If Modern Mail's product vision depends on *every* AI-generated creative direction being able to carry per-recipient personalization end-to-end without human intervention at Click2Mail, the documented mail-merge path does not deliver that today — the realistic path is either (a) a human one-time UI setup per reusable layout, or (b) Modern Mail pre-rendering fully personalized PDFs itself and using the Batch/XML API's one-to-one mode, shifting the personalization burden entirely onto Modern Mail's own rendering pipeline rather than Click2Mail's. This is a genuine fork in direction, not a detail — it affects how much of the "print-ready PDF" responsibility PROJECT_BLUEPRINT.md's pipeline diagram implicitly assumes Click2Mail owns versus Modern Mail owns.
- **No confirmed webhook/push mechanism (§2, §4).** If true, campaign-status freshness in Modern Mail's Command Center / Mail Status UI is bounded by however often Modern Mail chooses to poll, with associated cost/rate-limit exposure given unknown rate limits (§2, §15).
- **Payment happens at Click2Mail submission time, using billing details passed directly as query parameters on `/jobs/{id}/submit` (§4).** This means card data would transit through Modern Mail's own server action layer (or Modern Mail would need Click2Mail to support some tokenized/vaulted alternative not found in this research) if `submit` is called server-side — a PCI-scope question that needs to be resolved as part of any payment-flow design, not discovered mid-implementation.
- **Shipped-vs-mailed and merge-support-vs-not are product-tier splits, not configuration flags (§1, §11).** Modern Mail's current domain model (`CampaignBrief`, `CreativeSpec`) doesn't yet distinguish these; any future mapping from a Modern Mail campaign to a Click2Mail job needs to resolve which product tier a given campaign's requirements actually fall into.

---

## 17. Architectural implications for Modern Mail (constraints to design around — not a design)

Per your instruction, this section states *implications and constraints* Click2Mail's platform imposes, not an integration design or code plan. It exists so the eventual architecture discussion starts from accurate constraints rather than assumptions.

- **A print-ready PDF, in the vendor's expected color space and geometry, is the actual contract surface — not a `CreativeSpec` object.** Whatever Modern Mail's `CreativeSpec`/`PostcardPreview` template system produces today for on-screen preview would need a distinct rendering path to a CMYK, 300-DPI, bleed-and-safe-area-correct PDF before it is submission-ready; the two are not the same artifact and should not be assumed interchangeable without a defined conversion/export step.
- **Job creation and submission are separate, separately-priced, separately-committed actions with a real state machine in between (§4).** This maps reasonably well onto Modern Mail's own existing philosophy of explicit, reversible-until-committed states (`creative_approved` before `audience_confirmed` before `launched`, etc.) — the vendor's own `EDITING`/`AWAITING_PRODUCTION`/etc. states are a second, vendor-owned state machine that would need to be represented *alongside* Modern Mail's own campaign status, not collapsed into it, since they track genuinely different things (has the customer approved vs. has the vendor produced/mailed).
- **Address-list-as-a-first-class-object (not inline recipients) is how the vendor models "audience" (§10).** This is a natural fit for the Blueprint's own "Audience" pillar (translate a target-audience description into an actual mailing list) but confirms that whatever Modern Mail builds for audience/list management will ultimately need to produce a Click2Mail-shaped address list (with a chosen mapping schema) as one of its outputs, not just a count/estimate.
- **CASS runs automatically but NCOA is unconfirmed (§10, §15).** If NCOA turns out not to be part of Click2Mail's own pipeline, "audience quality" (a stated PROJECT_BLUEPRINT.md concern under Data Axle) may need to be partly solved upstream of Click2Mail, not assumed to be handled by the fulfillment vendor.
- **Variable data has a manual-authoring dependency today (§11, §16).** Any architecture that promises fully automated, no-human-touch personalization end-to-end needs to explicitly decide whether it accepts that dependency (one-time UI setup per layout) or routes around it (self-rendered PDFs + Batch/XML one-to-one submission) — this is a fork the Blueprint's pipeline diagram doesn't currently distinguish between, and it has real consequences for how much templating/rendering responsibility stays inside Modern Mail versus is handed to the vendor.
- **Status visibility is pull-based and rate-limit terms are unknown (§2, §4, §15).** Any design for keeping a launched campaign's Command Center status fresh needs to treat "how often can we poll" as an open constraint to confirm, not an assumed-cheap operation.
- **Credential model is coarse (account password, not scoped key) (§3, §16).** Wherever these credentials end up living in Modern Mail's infrastructure, they carry full-account risk, which is a materially different threat model than the scoped API key already in use for Anthropic (`ANTHROPIC_API_KEY`) and should be treated with commensurately more care, not the same pattern reused by default.
- **Product-tier and format coverage is broader than Modern Mail's current domain model (§1, §6).** `MailFormat` (currently `"postcard_4x6"` only) and the rest of `CreativeSpec` would need to grow to represent whichever additional Click2Mail products (starting with 5×8, per the current milestone) Modern Mail intends to support, including the shipped-vs-mailed and merge-vs-no-merge splits, before those products can be represented faithfully end-to-end.

---

## Appendix A — Confirmed API base URLs and endpoints referenced in this report

All paths below are staging (`stage-rest.click2mail.com`); production is assumed to mirror the same path structure on a production hostname (not explicitly confirmed in this pass, but consistent with every other staging/production pairing described in the docs).

| Purpose | Method | Path |
|---|---|---|
| Credit balance | GET | `/molpro/credit` |
| Purchase credit | POST | `/molpro/credit/purchase` |
| Create document | POST | `/molpro/documents` |
| Create document from URL | POST | `/molpro/documents` (URL variant) |
| Get variable data for document | GET | `/molpro/documents/variableData/{id}` |
| Create address list | POST | `/molpro/addressLists` |
| Address correction (CASS, interactive) | POST | `/molpro/addressCorrection` |
| Create job | POST | `/molpro/jobs` |
| Create job from template | POST | `/molpro/jobs/jobTemplate?templateName=...` |
| Update job | POST | `/molpro/jobs/{id}` (update semantics) |
| Get job status/details | GET | `/molpro/jobs/{id}` |
| List jobs (filterable) | GET | `/molpro/jobs` |
| Submit job | POST | `/molpro/jobs/{id}/submit` |
| Cancel submitted job | POST | `/molpro/jobs/cancelSubmittedJob` |
| Duplicate job | POST | `/molpro/jobs/{id}/duplicate` (pattern) |
| Create proof | POST | `/molpro/jobs/{id}/proof` |
| Get proof | GET | `/molpro/jobs/{id}/proof/{proofId}/{sessionId}` |
| Accept proof | POST | `/molpro/jobs/{id}/proof/accept` |
| EDDM info for job | GET | `/molpro/jobs/{id}/eddm` |
| Cost estimate | GET | `/molpro/costEstimate` |

## Appendix B — Sources consulted

- `developers.click2mail.com` — Introduction, API 101, Getting Started, Getting Access to the API, Quick Start Guide, Building Your First API Call, HTTP Response Codes, Your First Mail Job, Upload a Document, Upload an Address List, Using Document Templates, Using Mail Merge, Create a Job, `/reference` (full endpoint index + detail pages for Create a Job, Submit a Job, Create/Get/Accept Proof, Get a Cost Estimate, Purchase Credit, Create a Document, Address Correction, EDDM job info, Get Variable Data), `/recipes`.
- `rest.click2mail.com` — legacy Quick Start Guide, legacy VDP/mail-merge Quick Start Guide.
- `click2mail.com` — `/c2m-templates`, `/postcard-5-x-8`, `/postcard-5-x-8-shipped`, `/shipped-products/postcards`, `/batch`.
- `templates.click2mail.com/postcards/5x8`.
- `blog.click2mail.com` — "Direct Mail Design Specs Checklist for USPS-Compatible Mailpieces," "How to Format a Postcard: Essential Guidelines" (attempted; largely non-numeric).
- `support.click2mail.com` — API FAQ category index, "Relevant Job Statuses," "REST API Return Codes," "c2m_uniqueid," "Get Product Parameters," "Testing," "API Documentation," "Insufficient Funds Error in REST," "Priority Mail Express Document Class," "Maximum Page Limit," "What is Variable Data, Personalization, or Mail Merge?"
- `status.click2mail.com` — live operational status and 90-day uptime.
- This Gmail account — searched exhaustively for prior Click2Mail correspondence; **none found** (see note at top of document).

---

*This document reflects publicly available documentation as read during this research session. Several sections explicitly depend on the vendor confirming or correcting specific points (§15). No architectural or implementation decision should be made from this document alone where a claim is tagged [ASSUMPTION] or [UNKNOWN] without first resolving it.*
