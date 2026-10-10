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
   - `ANTHROPIC_API_KEY` — writes the campaign conversation and the postcard concepts.
   - `OPENAI_API_KEY` — makes the photographs inside Studio.
   Add both for Production (and Preview if you use it).
7. Open **Deployments**, open the latest production deployment, and choose **Redeploy**. Environment variables are picked up on a new deployment. A refresh of the old deployment is not enough.

You do not create tables, run SQL, or copy database passwords into the project by hand. The Neon and Blob connections create the variables below. The app creates its tables the first time someone opens or saves a campaign.

## Variables the Storage tab creates

| Connection | Variable the app reads | What it is for |
| --- | --- | --- |
| Neon Postgres | `DATABASE_URL`, or `POSTGRES_URL` if that is what Neon created instead | Campaigns, and any saved reference-corpus records |
| Vercel Blob | `BLOB_READ_WRITE_TOKEN` | Photographs Studio generates. The store stays **Private**. |

Neon often adds other variables (`DATABASE_URL_UNPOOLED`, host, user, and so on). Leave them. The app uses `DATABASE_URL` when it is set, and otherwise `POSTGRES_URL`.

Without those database variables, the live site cannot remember a campaign. Creating one and then opening it returns a 404, because each Vercel request has its own temporary disk. Local development does not need them.

Without the Blob token, generated photographs stay on the local disk. That disk is not shared on Vercel, so Studio on the live site needs Blob.

The Blob store must stay **Private**. That is the setting Vercel picks when you create a store, and a store cannot be changed from Private to Public later. Studio saves each photograph into that private store, then the site itself shows the picture. The browser does not open the Blob address. Do not create a second, public store for photographs, and do not delete the private one. `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY` can stay as Vercel created them. The app does not need you to edit them.

Without the two API keys, campaign pages still open. The writing and the photographs fall back to the built-in practice behavior instead of calling Anthropic or OpenAI.

## How long the AI calls can run

Conversation, concept writing, and photograph generation are allowed **60 seconds** per click. That is the Hobby plan maximum on projects that do not have Fluid Compute turned on. Setting a higher limit makes the deploy fail with “maxDuration must be between 1 and 60.”

Vercel’s current Hobby plan **with Fluid Compute** allows up to 300 seconds, and that is often the default. This app stays at 60 so a deploy cannot fail on the stricter Hobby cap. If Settings → Functions shows that Fluid Compute is on and a longer limit is allowed, the 60 second cap in the campaign page can be raised later.

One concept-writing click is usually inside 60 seconds. Photographs do not wait inside that click. Studio starts one photograph in the background and keeps that same visit alive until the picture is saved or the 60 second cap runs out. The page checks back every few seconds. A fast preview is made for each direction. The direction you choose is made again, larger, for print. If a photograph is cut off, Studio tries that one once more. A photograph that already finished is kept and is not made again.

## What you do not configure

The research cards Studio reads are part of the application code. They are not a folder you upload, and they are not in the database. Nothing else is read from a loose file when the site runs on Vercel.

Local `npm run dev` needs none of the variables above. Campaigns and photographs are written under `.data/` in the project folder. That folder is not committed.

## After you redeploy

Open the production site, start a new campaign, and confirm the campaign page opens instead of a 404. Leave the tab and come back. The same campaign should still be there.
