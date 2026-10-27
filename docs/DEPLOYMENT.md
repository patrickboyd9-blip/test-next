# Putting Modern Mail on Vercel

Modern Mail remembers campaigns in a database, and it stores the photographs Studio generates in Vercel Blob. On a laptop, with no extra setup, it still uses ordinary files in a `.data` folder. You only connect storage for the live site.

The live site is the Vercel project in the **Modern Mail** team. The production address is `test-next-modern-mail2.vercel.app`.

## What to click

Do these in order. Connecting storage does not update the site that is already running until you redeploy.

1. Open [vercel.com](https://vercel.com) and select the **Modern Mail** team.
2. Open the project **test-next-modern-mail2** (the one that serves `test-next-modern-mail2.vercel.app`).
3. Open the **Storage** tab.
4. Choose **Create** (or **Connect Store** / **Browse Marketplace**, depending on what the tab shows) and pick **Neon**. Neon is the Postgres database. Create a database if you do not already have one, then connect it to this project. Include **Production**. Include **Preview** as well if you use preview links.
5. Back on the **Storage** tab, create or connect **Blob** the same way, and connect that store to this project (Production, and Preview if you use it).
6. Open **Settings**, then **Environment Variables**. Add:
   - `ANTHROPIC_API_KEY` — writes the campaign conversation and the postcard concepts, and runs the art director and the critic. Add it for **Production and Preview**. A preview without this key lays cards out from the written rules, so it cannot be the vision test.
   - `OPENAI_API_KEY` — makes the photographs inside Studio.
   Add both for Production and Preview.
7. Open **Deployments**, open the latest production deployment, and choose **Redeploy**. Environment variables are picked up on a new deployment. A refresh of the old deployment is not enough.

You do not create tables, run SQL, or copy database passwords into the project by hand. The Neon and Blob connections create the variables below. The app creates its tables the first time someone opens or saves a campaign, and the first time someone sends a design request.

## Variables the Storage tab creates

| Connection | Variable the app reads | What it is for |
| --- | --- | --- |
| Neon Postgres | `DATABASE_URL`, or `POSTGRES_URL` if that is what Neon created instead | Campaigns, reference-corpus records, and design requests |
| Vercel Blob | `BLOB_READ_WRITE_TOKEN` | Photographs Studio generates, and logos or images attached to a design request. The store stays **Private**. |

Neon often adds other variables (`DATABASE_URL_UNPOOLED`, host, user, and so on). Leave them. The app uses `DATABASE_URL` when it is set, and otherwise `POSTGRES_URL`.

Without those database variables, the live site cannot remember a campaign. Creating one and then opening it returns a 404, because each Vercel request has its own temporary disk. Local development does not need them.

Without the Blob token, generated photographs stay on the local disk. That disk is not shared on Vercel, so Studio on the live site needs Blob.

The Blob store must stay **Private**. That is the setting Vercel picks when you create a store, and a store cannot be changed from Private to Public later. Studio saves each photograph into that private store, then the site itself shows the picture. The browser does not open the Blob address. Do not create a second, public store for photographs, and do not delete the private one. `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY` can stay as Vercel created them. The app does not need you to edit them.

Without the two API keys, campaign pages still open. The writing and the photographs fall back to the built-in practice behavior instead of calling Anthropic or OpenAI.

## Reference library

Studio already knows the written grades for the mailbox and vendor pieces. Those notes ship with the app. The photographs of those pieces do not. They stay out of git.

The daily pull also indexes the written library: every MMR markdown record, the gold recipes under `gold/`, and the rest of the C-3PO branch. Anything inside a `private/` folder is skipped and never stored. Copy, layout, photograph direction, and the critic read that index. The index is cached in the database (or `.data` on a laptop). It does not copy the research into this public repository.

**Production needs `RESEARCH_GITHUB_TOKEN` set in Vercel** for this grounding to work on the live site. Without that token the app still runs, and it still uses the written seed that ships in the code, but it cannot see the full private library. Preview needs the same token if you want preview generations grounded the same way.

To let the live site keep learning from new mail, add these in **Settings → Environment Variables** for **Production and Preview**:

| Variable | Required | What to put |
| --- | --- | --- |
| `RESEARCH_GITHUB_TOKEN` | Yes, for the daily pull | A GitHub personal access token that can read the private `patrickboyd9-blip/modern-mail-research` repository. Classic token: `repo` scope. Fine-grained token: contents read on that repo only. |
| `CRON_SECRET` | Yes, for the daily pull and the on-demand buttons | A long random string you invent. Vercel sends it as the cron password. The same value unlocks “sync now” and the benchmark. |
| `ANTHROPIC_API_KEY` | Already listed above | Also scores a new mailer that arrives without a written grade, and lets the art director look at the reference photographs. Without it, the app still lays out cards from the written rules. |
| `BLOB_READ_WRITE_TOKEN` | Already created by Blob | Where the downloaded photographs are stored. The store stays private. |
| `DATABASE_URL` or `POSTGRES_URL` | Already created by Neon | Where the mailer index is stored. |

Optional. Leave them blank unless you need to change a default.

| Variable | Default | What it changes |
| --- | --- | --- |
| `RESEARCH_GITHUB_REPO` | `patrickboyd9-blip/modern-mail-research` | The private repo. |
| `RESEARCH_MANDO_REF` | `main` | Branch for the vendor library (`images/index.json`). |
| `RESEARCH_C3PO_REF` | `cursor/visual-reference-corpus-3752` | Branch for Patrick’s mailbox pieces (`assets/physical/`). Anything inside a `private/` folder is skipped. |
| `DESIGN_DIRECTOR` | the vision model when `ANTHROPIC_API_KEY` is set, otherwise the written rules | Set to `rules` to skip the vision art director. |
| `DESIGN_CRITIC` | the vision model when `ANTHROPIC_API_KEY` is set, otherwise a machine estimate | Set to `machine` to score from measurements only. A machine score is labeled "machine estimate" until the vision critic runs. The vision critic scores the print-resolution card. If that render cannot be produced, the score stays a machine estimate. |
| `DESIGN_CRITIC_ROUNDS` | `3` | How many layout repairs to try. The app will not go past 3. |
| `DESIGN_SYNC_BATCH` | `40` | How many new mailers one daily run downloads. |
| `RESEARCH_INDEX_BATCH` | `80` | How many written records one daily run reads into the research index. The job repeats the batch a few times so a full library catches up. `npx tsx scripts/research-coverage.ts` reads the rest on a laptop. |
| `DESIGN_ANALYZE_CAP` | `8` | How many ungraded mailers one run sends to the vision model for a short written grade. |
| `VISION_TASTE_BATCH` | `4` | How many reference photographs one run reads with the vision model for the taste library. The daily job and “sync now” both do this batch. A separate backfill clears the rest. |
| `VISION_TASTE_PASSES` | `8` | How many batches `scripts/backfill-vision-taste.ts` will run before it stops. |
| `DESIGN_CANDIDATE_COUNT` | `12` | How many compositions Studio tries before it keeps the best three. Those layouts span the postcard families — integrated, full-bleed, panel, and the other composition modes — varied by whether the offer or the headline leads. |
| `DESIGN_OWNER_FAVORITES` | `PM-047,PM-054,PM-022,PM-056,PM-057` | Mailer ids retrieval always weights highly and the critic uses as calibration anchors. PM-056 is the Wondercide postcard. PM-057 is the simple food or retail coupon: one hero product photo, a short playful headline, a full-width offer strip, a barcode, and an expiry. Comma-separated. The lessons are principles, not layouts to copy. |
| `BLUEPRINT_BATCH` | `4` | How many reference photographs one run sends to the vision model for a structural blueprint. The daily job and `POST /api/design-library/blueprints` both use this. Structural blueprints from the written analyses are free and are stored for every eligible mailer. |
| `BLUEPRINT_PASSES` | `8` | How many vision batches `scripts/backfill-blueprints.ts` will run before it stops. |
| `DESIGN_INTERNAL_OWNERS` | empty | Comma-separated campaign owner ids who may see a source thumbnail in “Use a blueprint.” Everyone else sees an abstract wireframe. Leave this empty on a customer preview. |
| `DESIGN_CANDIDATE_BOARD` | on | Set to `off` to skip the twelve-up board and use the earlier one-layout path. |
| `DESIGN_CANDIDATE_RENDERS` | on, when the vision critic is on | Set to `off` to rank from measurements only and skip the preview renders. |
| `DESIGN_BOARD_BUDGET_MS` | `75000` | How long the vision ranking may run before it keeps the measurement scores. It will not go past 90 seconds. |
| `DESIGN_MODEL` | `claude-sonnet-5` | The model that directs, reads reference photographs, and critiques. |
| `DESIGN_INPUT_USD_PER_MTOK` | `3` | Estimate used only in the cost log. Not a bill. |
| `DESIGN_OUTPUT_USD_PER_MTOK` | `15` | Estimate used only in the cost log. Not a bill. |
| `DESIGN_INTELLIGENCE` | on | Set to `off` to return to the previous layout path. |

The daily job runs at 17:45 UTC. That is 9:45am during Pacific Standard Time and 10:45am during Pacific Daylight Time, so it is always after 9:30am Pacific. Vercel calls `GET /api/cron/design-library`.

To pull immediately, send a POST to `https://test-next-modern-mail2.vercel.app/api/design-library/sync` with the header `Authorization: Bearer` and the `CRON_SECRET` value. The benchmark is the same header on `POST /api/design-benchmark`.

The same header on `POST /api/design-library/blueprints` stores a blueprint for each eligible mailer (MMR and PM records, never anything under `private/`). The first pass writes the structure from the written analysis. When `ANTHROPIC_API_KEY` is set, each batch then asks the vision model to replace up to `BLUEPRINT_BATCH` of those with a reading of the photograph. A vision blueprint is one image plus about 1,800 output tokens. At the default `$3` per million input tokens and `$15` per million output tokens, that is a few cents per mailer, logged as step `blueprint`. It is an estimate, not a bill. Send `{ "limit": 4 }` to change the batch. On a laptop, the same job is `npx tsx scripts/backfill-blueprints.ts`. Blueprints go to Neon when `DATABASE_URL` is set, and to `.data/blueprints` otherwise. Source photographs stay in `.data/reference-library` or Blob and are not committed. Tone, vertical, offer type, and copy pattern are the lists in `lib/design-intelligence/blueprint-tags.ts`. Edit that file to add a tag. Each copy pattern is an abstract slot template, such as `[Deadline] is coming. Don't lose [benefit].` A vision reading can propose a new snake_case tag when none of these fit. The proposal is stored on the blueprint and is not written into the file. Deadline-loss framing is only used for an offer the reader can already lose, such as enrollment. A free inspection uses another pattern. After the slots are filled, a copy editor checks grammar, logic, and fit. That call runs when `ANTHROPIC_API_KEY` is set, a few hundred tokens, logged as step `copy-edit`. Without the key, the same fit rules still refuse a pattern that does not suit the offer. Stored blueprints are version `1.1.0`. An older row is extracted again on the next backfill.

The same header on `POST /api/design-library/vision-taste` reads the next batch of reference photographs and stores a design reading for each one (eye path, focal element, scale, whitespace, palette roles, how type sits with the picture, the response block, what works, and a grade). Send `{ "limit": 4 }` to change the batch. Run it again until `pending` is 0. The response includes `anthropicConfigured`, `director`, and `critic`. `director` is `model` and `critic` is `vision` when `ANTHROPIC_API_KEY` is present. `GET` with the same header returns that status and does not start a batch. On a laptop, the same job is `npx tsx scripts/backfill-vision-taste.ts`. Photographs stay in `.data/reference-library` or Blob. The readings go to Neon when `DATABASE_URL` is set, and to `.data/vision-taste` otherwise. Neither folder is committed.

Preview links use Vercel Authentication. A script has to send the automation bypass as well as the cron secret, or the request stops at the login wall and never reaches the route:

```bash
curl -X POST "$PREVIEW_URL/api/design-library/vision-taste" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" \
  -H "content-type: application/json" \
  -d '{"limit":1}'
```

`VERCEL_AUTOMATION_BYPASS_SECRET` is the Protection Bypass for Automation secret from the project settings. A 200 with `anthropicConfigured: true` means the preview can run the vision test.

Thumbs in Studio are stored per campaign and per the campaign’s owner, in the `concept_feedback` table (or `.data/concept-feedback` on a laptop). The next generation for that owner uses those likes and dislikes when it chooses references.

The fixed exam is `npx tsx scripts/design-exam.ts --mode baseline` and `--mode after`. It writes scores and images under `artifacts/design-exam/`, which is not committed. Without `ANTHROPIC_API_KEY` those scores are machine estimates.

The persuasion layer is the list in `lib/design-intelligence/persuasion-principles.ts`. The art director picks two or three principles and records one emotion and one core need. The client can choose the emotion; otherwise the art director recommends one. Audience awareness defaults to a cold list, which leads with the problem. A past customer leads with the offer. Every card also keeps a sell-the-outcome line, and the studio shows a second angle (a threat plus one easy action) labeled as A/B test options. The critic rejects a fake deadline, an invented count, an unsupplied testimonial, a threat with no easy action, a fake check, a government look-alike, steering language on a housing card, and the word free on a Medicare card. An attorney card that does not say Advertisement, or that uses dramatic injury imagery, is also a hard fail. The studio warns that Florida Bar 4-7.18 requires a 30-day wait after an accident before mailing. That check is rules, so it adds no model cost. When the vision critic runs, the same checklist is in its prompt.

On a laptop, put the photographs in `.data/reference-library` (that folder is not committed) and run `npx tsx scripts/seed-reference-library.ts`. If the Blob token is present, the script also uploads them. If it is not, the benchmark reads the local files.

## How long the AI calls can run

Conversation, concept writing, and photograph generation are allowed **60 seconds** per click. That is the Hobby plan maximum on projects that do not have Fluid Compute turned on. Setting a higher limit makes the deploy fail with “maxDuration must be between 1 and 60.”

Vercel’s current Hobby plan **with Fluid Compute** allows up to 300 seconds, and that is often the default. This app stays at 60 so a deploy cannot fail on the stricter Hobby cap. If Settings → Functions shows that Fluid Compute is on and a longer limit is allowed, the 60 second cap in the campaign page can be raised later.

One concept-writing click is usually inside 60 seconds. Photographs do not wait inside that click. Studio starts one photograph in the background and keeps that same visit alive until the picture is saved or the 60 second cap runs out. The page checks back every few seconds. A fast preview is made for each direction. The direction you choose is made again, larger, for print. If a photograph is cut off, Studio tries that one once more. A photograph that already finished is kept and is not made again.

## What you do not configure

The written grades for the research cards ship in the application code. The photographs do not. The "Reference library" section above is where the token, the daily pull, and those photographs are set.

Local `npm run dev` needs none of the variables above. Campaigns and photographs are written under `.data/` in the project folder. That folder is not committed. A local reference library, if you extracted one, lives in `.data/reference-library` and is not committed either.

## After you redeploy

Open the production site, start a new campaign, and confirm the campaign page opens instead of a 404. Leave the tab and come back. The same campaign should still be there.
