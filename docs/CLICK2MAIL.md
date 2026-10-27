# Click2Mail

This is the first connection between Modern Mail and Click2Mail, the printer that can mail a postcard. It is built for **staging first**. A staging job does not go to a real mailbox.

You do not need to read code to use it. The smoke test at the bottom is the part you run with real staging credentials.

## What a customer sees

After a postcard is approved, the campaign shows **Print & mail** with a **Test mode** label.

That screen asks for recipients in one of two ways:

- Upload a CSV with the columns `first,last,address1,address2,city,state,zip`
- Or send one test piece to an address you type in

It shows how many pieces that is, and an **estimated First Class postage** for a standard 5×8 address. That figure is postage only. Production is additional, and a nonstandard address costs more. Click2Mail charges the staging account when the job is submitted.

If you send close to **8:00 PM ET**, or after it, the screen says so. Click2Mail runs API jobs through a batch queue. A job that arrives near the cutoff can miss that day’s mailing and go out the next business day.

Sending the test builds a two-page PDF of the approved postcard, uploads it, creates the address list, creates the job, asks for a proof, and submits it with **User Credit**. The campaign keeps the document id, address-list id, job id, status, and times. The status line updates by asking Click2Mail again. Click2Mail does not call us when something changes.

Staging usually has no mail tracking. That is expected.

## What stays off

Production mailing is off unless both of these are set on the server:

- `C2M_ENV=prod`
- `C2M_ALLOW_PRODUCTION=true`

Either one alone does nothing live. The default is staging, and the production flag defaults to off. There is no button in the product that turns production on.

The production web address we call is `https://rest.click2mail.com/molpro`. That host is the likely production pair of the staging host. If Click2Mail gives you a different one, set `C2M_BASE_URL`.

## The print file

The PDF matches the 5×8 postcard we already locked:

- Two pages
- Each page is 8.5 by 5.5 inches, which is 612 by 396 points
- That size includes 0.25 inches of bleed on every side of the 8 by 5 inch card
- Words stay 0.25 inches inside the trim
- The address side leaves two areas blank, because Click2Mail prints the address, indicia, and barcode there
  - A block 3.6875 inches from the right and 2.875 inches from the bottom
  - A strip 6 inches from the right and 0.625 inches from the bottom

The front uses the final Studio photograph when that file is already at least 300 dots per inch at print size. A smaller preview is not stretched. If the final photograph is not ready yet, the file uses the approved words on a solid color so a staging test can still go out. Fonts are embedded. Color is still RGB. Click2Mail prefers CMYK, and an RGB file can shift when it is printed. We are not hiding that.

The address side prints the approved creative in the open area only: the brand, a short message, the offer, the phone, a QR code for the scan destination, and the return lines. The address panel and the barcode strip stay blank so Click2Mail can print the recipient, indicia, and barcode there.

## Credentials

Set these on the server, or in your shell before the smoke test. Never commit them.

| Name | Purpose |
|---|---|
| `C2M_ENV` | `stage` (default) or `prod` |
| `C2M_STAGE_USERNAME` | Staging username. Used first when `C2M_ENV` is stage. |
| `C2M_STAGE_PASSWORD` | Staging password. Used first when `C2M_ENV` is stage. |
| `C2M_USERNAME` | Account username. Staging uses this only when the stage username is empty. Production uses this name. |
| `C2M_PASSWORD` | Account password. Same fallback rule as the username. |
| `C2M_ALLOW_PRODUCTION` | Must be the word `true` before any production call. Every Door stays on staging even then. |
| `C2M_BASE_URL` | Optional. Overrides the host. |

Every Door ordering is described in `docs/EDDM.md`. It uses the same staging sign-in. It does not send a customer USPS account id.

The app signs in with HTTP Basic auth. Passwords are not written to logs.

Click2Mail speaks XML. We do not use their JSON.

If Click2Mail answers with HTTP 524, the client tries the same call up to three times.

## Product names you may have to change

Click2Mail does not publish the exact postcard option strings. They come from the product picker inside their site. The defaults below are our best reading of their docs. Every one can be changed without a code change.

| Environment variable | Default |
|---|---|
| `C2M_DOCUMENT_CLASS` | `Postcard 5 x 8` |
| `C2M_DOCUMENT_FORMAT` | `PDF` |
| `C2M_LAYOUT` | `Double Sided Postcard` |
| `C2M_PRODUCTION_TIME` | `Next Day` |
| `C2M_ENVELOPE` | a single space, which means no envelope |
| `C2M_COLOR` | `Full Color` |
| `C2M_PAPER_TYPE` | `White Matte with Gloss UV Finish` |
| `C2M_PRINT_OPTION` | `Printing both sides` |
| `C2M_MAIL_CLASS` | `First Class` |
| `C2M_BILLING_TYPE` | `User Credit` |
| `C2M_ADDRESS_MAPPING_ID` | `1` |
| `C2M_POSTAGE_5X8_STANDARD` | `0.495` |
| `C2M_POSTAGE_NONSTANDARD` | `0.82` |

A 6×9 postcard uses the same layout, paper, print option, and First Class mail class, with document class `Postcard 6 x 9`. The smoke test selects it with `--size 6x9`.

These strings match Click2Mail’s postcard job, not a letter. A letter job uses `Letter 8.5 x 11`, layout `Address on Separate Page`, a `#10` envelope, and `White 24#` paper. We do not send those for a postcard. We also do not send `quantity` when the job has an address list. That field is only for products that are not mailed to a list. A letter envelope, letter layout, or letter paper is rejected before the file is uploaded.

Address lists are ready when the status is **3 or higher and not 9**. Their older docs say 3, a legacy guide says 5, and 9 means error. A live staging list reached **3** (`CASS Standardized`) and never returned 5. `C2M_ADDRESS_LIST_READY_MIN` (default `3`) and `C2M_ADDRESS_LIST_ERROR_STATUS` (default `9`) change that rule.

## Staging credit and postage

A staging credit purchase can return Success while `GET /credit` stays at **0.00**. Submitting with **User Credit** still succeeds. The smoke test does not stop `--submit` on staging because the balance is under $1. The in-app test order does not check the balance either. `--skip-balance-check` is there if you need the same skip outside staging. `--buy-credit` still adds $10 with the published staging test card when you ask for it.

Click2Mail confirmed First Class 5×8 postcard postage at **$0.495** per standard address. A nonstandard address is **$0.82** plus production. The on-screen estimate uses those rates. It is not a live quote, and it does not include production.

An earlier staging job (1297313, total $1.30) was billed as **First Class Automation Letter** at **$0.707**. That is letter postage. Postcard jobs now go out with the postcard document class, the postcard layout, First Class, and no envelope, so they are not submitted with letter product settings.

The other paper we have seen named is `White 80# Gloss with UV Coating`. If the first paper name is rejected, pass the other one to the smoke test.

## Same-day cutoff

Click2Mail’s business-day cutoff is **8:00 PM ET**. API jobs sit in a batch queue and are processed in the order they arrived, so a job submitted near the cutoff can miss that day’s mailing. The print & mail screen says so from 6:00 PM ET onward, after 8:00 PM ET, and on Saturday and Sunday. After the cutoff, or on a weekend, the piece mails with the next business-day batch.

## Run the smoke test

From the project root, with staging credentials in the environment:

```bash
export C2M_ENV=stage
export C2M_USERNAME="your-staging-username"
export C2M_PASSWORD="your-staging-password"

npm run c2m:smoke
```

That checks the credit balance, builds a sample postcard PDF, uploads it, creates a one-address list, creates a job, and requests a proof. It does **not** submit the job, so it does not spend credit.

On staging, a balance under $1 does not stop the run. Staging can keep reporting 0.00 after a purchase and still accept the submit. To add $10 anyway:

```bash
npm run c2m:smoke -- --buy-credit
```

That uses Click2Mail’s published staging test card (`4111111111111111`, a future expiration). It will not do that against production. Outside staging, a balance under $1 stops the run unless you pass `--skip-balance-check`.

When the proof looks acceptable and you want to spend staging credit:

```bash
npm run c2m:smoke -- --submit
```

If Click2Mail rejects a product name, change that one string and run again:

```bash
npm run c2m:smoke -- --paper-type "White 80# Gloss with UV Coating" --layout "Double Sided Postcard"
```

You can also pass `--size`, `--document-class`, `--print-option`, `--mail-class`, `--production-time`, `--color`, `--envelope`, `--document-format`, `--billing-type`, and `--address-mapping-id`. `--size 6x9` submits a 6×9 postcard.

The script prints each step’s id and status. It does not print your password or the test card number.

A job left without `--submit` sits in editing. Editing has not been paid.

## What this does not do

- It does not take a customer’s credit card
- It does not buy a mailing list
- It does not turn the file into CMYK
- It does not mail from production unless the environment and the flag are both set
- Staging will not return Intelligent Mail tracking

Every Door Direct Mail is a separate path. The customer enters a USPS CRID once. The Click2Mail calls stay off until `C2M_EDDM_SUBMIT=true` on staging. A job template is the preferred way to name the product. See `docs/EDDM.md`. One staging order, paid with User Credit:

```bash
npm run c2m:eddm -- --crid 123456789 --pieces 400
```
