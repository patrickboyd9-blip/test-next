# Every Door Direct Mail

Every Door Direct Mail sends one piece to every address on the carrier routes you choose. The piece says **Postal Customer**. There is no mailing list and no first name.

This is Retail EDDM: at least 200 pieces, and at most 5,000 pieces in one ZIP on one day. Bigger Business Mail Entry Unit mailings are not built yet.

## What you can do in the product

On the audience step, choose **Every door in an area**.

- Enter a ZIP code, or a street address. An address that already contains a ZIP uses that ZIP. An address without a ZIP is looked up through OpenStreetMap.
- Carrier routes draw on an OpenStreetMap map. Click a line, or use the checkbox, to select or deselect it.
- Filter by median age, median income, and household size. Those figures come from the free USPS route feed. A route that is missing a figure stays on the map.
- The screen shows residential count, business count, total pieces, and a **postage estimate**. That figure is USPS Retail postage at $0.26 a piece. It is not a checkout price. Print and drop-off are not included.
- The card is a 6.5×9 or a 6.25×11. A 5×8 does not qualify.
- The address side leaves a 4 inch by 2 inch box blank at the bottom-right of the card. Click2Mail prints **POSTAL CUSTOMER** and the indicia there. Those measurements come from Click2Mail's Word templates (see below). The preview shows the block so you can see where it lands. The print file does not draw it.
- Copy speaks to the neighborhood. A line such as "Dear Jane" is rewritten before it is printed.

Two templates start on these sizes: **Neighborhood coupon** (6.5×9) and **Neighborhood inspection** (6.25×11). Medicare is refused for Every Door, because the piece cannot pick out a person turning 65.

If the USPS feed is down, the last saved routes for that ZIP are shown, with a note that they were saved earlier. If nothing has been saved, the screen says to try again and the rest of the app keeps working.

## Click2Mail

Click2Mail answered on Oct 26, 2026 that Every Door should use their full-service permit. On Oct 27, Mahesh said job 1304272 returned "Sku not found" because the mail class was typed by hand. The job is created from a **job template** saved in the Click2Mail staging site (`C2M_EDDM_JOB_TEMPLATE`, or `C2M_EDDM_JOB_TEMPLATE_6_5X9` / `C2M_EDDM_JOB_TEMPLATE_6_25X11`). The API can start that template. It cannot create one. There is no endpoint for that.

If no template name is set, the order calls `GET /productOptions/advanced` and sends only a document class and mail class from that response. A Full Service string is used when the list contains one. `Postage Paid in Advance` is used when that is the only mail class the list returns. `C2M_EDDM_MAIL_CLASS` is ignored unless it matches one of those returned strings exactly.

Howard at Click2Mail said a USPS CRID is required for the postal paperwork. Without it the job is held. The customer enters it once on Print & mail. It is saved on the business and remembered on this machine for the next campaign. The free signup is the [Business Customer Gateway](https://gateway.usps.com/).

The customer pays Modern Mail first. Nothing is sent to Click2Mail until that payment is recorded (`campaign.payment.status` is `paid`). Checkout itself is a separate branch. On staging only, `C2M_EDDM_ASSUME_PAID=true` lets an operator run one job before that checkout exists. Production ignores the flag.

The host is staging (`https://stage-rest.click2mail.com/molpro`) unless `C2M_BASE_URL` overrides it. Production Every Door is refused even when production mail is otherwise allowed.

A paid staging order, with `C2M_EDDM_SUBMIT=true` and a CRID, does this:

1. `GET /productOptions/advanced`, so the document class is an exact value from Click2Mail.
2. `POST /documents` with the print PDF. The address block on that PDF is blank.
3. `POST /jobs/jobTemplate` when a template name is set, then `POST /jobs/{id}/update` with the document id, the piece count, and the CRID. Otherwise `POST /jobs` with the looked-up product strings, then `POST /jobs/{id}/update` with the CRID. No address list.
4. `POST /jobs/{id}/eddmInfo` with the mailer name and return address.
5. `POST /jobs/{id}/eddmPo` once per delivering post office. This has to come before the routes. The call needs the facility name, street, city, state, ZIP, phone, piece count, `deliveryType`, and `routeType`. Click2Mail does not look these up. We do.
6. `POST /jobs/{id}/eddmRoute` once per route. The route value is the ZIP plus the route id, such as `10001-C071`.
7. `GET /jobs/{id}/cost?details=true` for User Credit, then `GET /credit`, then `POST /jobs/{id}/submit` with billing type `User Credit`. The balance is compared with that job total, including tax. If the cost call fails, the check uses the $0.26 postage estimate instead.

The delivering post office comes from the USPS route feed (`FACILITY_NAME`) and the USPS post office locator at `tools.usps.com` (`POLocator/findLocations`), matched on the facility name. A successful lookup is saved for seven days. If the locator is down, a small saved table covers offices we have already read (James A. Farley, 421 8th Ave, New York, NY 10001, 212-330-3296). USPS Web Tools were retired, and the newer Locations API needs a key we do not have. The public locator is the workable free source. If a selected route still has no street or no phone, checkout stops with a plain-English message and Click2Mail is not called.

`Invoice` is not enabled on this staging account. Card payment through the API is refused. User Credit is the only payment. The staging balance on Oct 27 was $347.40. A credit purchase can say Success without changing the balance. `C2M_EDDM_BILLING_TYPE` cannot switch this order to a card. The staging script forces User Credit.

Run one live staging order from your machine. This environment does not have the staging password, and it does not call Click2Mail.

```bash
C2M_ENV=stage C2M_STAGE_USERNAME=... C2M_STAGE_PASSWORD=... \
C2M_EDDM_CRID=123456789 \
C2M_EDDM_JOB_TEMPLATE="Your template name" \
npm run c2m:eddm -- --pieces 400 --zip 10001 --route C071
```

It prints the job id, status, and cost. It does not print the username or password. Leave the template unset only if you want the script to read product options instead. 400 pieces is the default so the order can fit a few hundred dollars of staging credit. The route may have more homes.

Product strings are not defaults we type. They come from the template or the product-options list. Optional overrides, and only when they match that list exactly:

| Variable | Role |
|---|---|
| `C2M_EDDM_JOB_TEMPLATE` | Template name from the staging site. Preferred. |
| `C2M_EDDM_JOB_TEMPLATE_6_5X9` | Template for the 6.5×9 card, if it differs. |
| `C2M_EDDM_JOB_TEMPLATE_6_25X11` | Template for the 6.25×11 card, if it differs. |
| `C2M_EDDM_CLASS_6_5X9` | Document class override. Must match the product list. |
| `C2M_EDDM_CLASS_6_25X11` | Document class override. Must match the product list. |
| `C2M_EDDM_MAIL_CLASS` | Mail class override. Must match the product list. Ignored when a template is set. |
| `C2M_EDDM_BILLING_TYPE` | The app can be set to Invoice later. The staging script always uses User Credit. |

### The address block

Downloaded Oct 26, 2026:

- https://templates.click2mail.com/every-door-direct-mail/6.5x9
- https://templates.click2mail.com/every-door-direct-mail/6.25x11

The 6.5×9 page is 9.5 by 7 inches. The 6.25×11 page is 11.5 by 6.75 inches. That is 0.25 inches of bleed on every side of a 9×6.5 and an 11×6.25 trim. On both backs the white address block is **4 inches wide and 2 inches tall**, flush to the bottom-right corner of the trim. The old USPS guess (a 1.625 by 1.375 inch stamp zone at the top-right, and a 3.4 by 0.8 inch Postal Customer line) is not what the template shows. The numbers live in `lib/print-spec/click2mail-reserved-zones.ts`.

David at Click2Mail is still confirming the 5×8 and 6×9 reserved boxes. Those current numbers are in the same file. The published 5×8 catalog version is not edited from that file.

## What is still unverified

- Whether commercial use of `https://gis.usps.com/arcgis/rest/services/EDDM/selectZIP/GPServer/routes/execute` is allowed. The feed is public and undocumented. It returned routes for ZIP 10001 during development.
- Which mail-class string is full service with the Click2Mail permit. Mahesh said the Oct 26 "Sku not found" errors came from typing the value. The order now uses a job template, or the exact text from `GET /productOptions/advanced`.
- Whether `deliveryType` for homes plus businesses should be `All` or another word. Residential alone sends `Residential`.
- The all-in price. The screen shows a postage estimate only.
