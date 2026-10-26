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

Click2Mail answered on Oct 26, 2026 that Every Door should use their full-service permit, in their words **PM EDDM (Full Service): includes the Click2Mail permit**. We do not build a bring-your-own-permit flow, and we do not send the customer's USPS account id.

Staging job **1304272** did not accept that phrase. `PM EDDM (Full Service)` and `EDDM Full Service` also returned "status 9: Invalid product options. Sku not found." The only mail class that created a job was **Postage Paid in Advance**. That is the default. `C2M_EDDM_MAIL_CLASS` still overrides it. Click2Mail has to confirm which string is full service with their permit.

The customer pays Modern Mail first. Nothing is sent to Click2Mail until that payment is recorded (`campaign.payment.status` is `paid`). Checkout itself is a separate branch. On staging only, `C2M_EDDM_ASSUME_PAID=true` lets an operator run one job before that checkout exists. Production ignores the flag.

Click2Mail recommends a job template made in the staging site. Set its name in `C2M_EDDM_JOB_TEMPLATE`. If that is empty, the order sends the product strings below. The host is staging (`https://stage-rest.click2mail.com/molpro`) unless `C2M_BASE_URL` overrides it. Production Every Door is refused even when production mail is otherwise allowed.

A paid staging order, with `C2M_EDDM_SUBMIT=true`, does this:

1. `POST /documents` with the print PDF. The address block on that PDF is blank.
2. `POST /jobs/jobTemplate` when a template name is set, then `POST /jobs/{id}/update` with the document id and the piece count. Otherwise `POST /jobs` with the product strings, a quantity, and no address list.
3. `POST /jobs/{id}/eddmInfo` with `mailerName`, `mailerAddress1`, `mailerCity`, `mailerState`, `mailerPostalcode`, and `mailerPhone`.
4. `POST /jobs/{id}/eddmPo` once per delivering post office. This has to come before the routes. Click2Mail returns "Job is not a EDDM job" if a route is sent first. The call needs the facility name, street, city, state, ZIP, phone, piece count, `deliveryType`, and `routeType`.
5. `POST /jobs/{id}/eddmRoute` once per route. The route value is the ZIP plus the route id, such as `10001-C071`. That form worked on job 1304272.
6. `GET /jobs/{id}/cost` for User Credit, then `GET /credit`, then `POST /jobs/{id}/submit` with billing type `User Credit`. The balance is compared with that job total, including tax. Job 1304272 was $337.92 plus $0.16 tax for 400 pieces. If the cost call fails, the check uses the $0.26 postage estimate instead.

Sign-in uses `C2M_STAGE_USERNAME` and `C2M_STAGE_PASSWORD`. If those are empty, staging falls back to `C2M_USERNAME` and `C2M_PASSWORD`.

The route feed names the delivering post office (`FACILITY_NAME`) and the city and state (`CITY_STATE`). It does not include a street or a phone. Those come from the USPS post office locator (`tools.usps.com` POLocator), matched on the facility name. A successful lookup is saved for seven days. If the locator is down, a small saved table covers offices we have already read (James A. Farley in 10001 is the first). If a selected route still has no street or no phone, checkout stops with a plain-English message and Click2Mail is not called.

`Invoice` returned "User does not have access to this payment method" on this staging account. Card payment through the API fails because the server never has Accept.js data, so card billing is refused. User Credit is the path for now. Before submit, the order reads `GET /jobs/{id}/cost` and then `GET /credit`. Submit stops when the balance is below that total, including tax. A credit purchase can say Success without changing the balance. If Click2Mail does not return a cost, the check uses the postage estimate. `C2M_EDDM_BILLING_TYPE` can switch to Invoice later, when the account has that method. It cannot switch to a card.

Product strings. Job 1304272 was created with the 6.5×9 document class and Postage Paid in Advance. The other strings are still the defaults below:

| Variable | Default |
|---|---|
| `C2M_EDDM_CLASS_6_5X9` | `EDDM Mailer 6.5 x 9` |
| `C2M_EDDM_CLASS_6_25X11` | `EDDM Mailer 6.25 x 11` |
| `C2M_EDDM_MAIL_CLASS` | `Postage Paid in Advance` |
| `C2M_EDDM_LAYOUT` | `We Prep and Mail` |
| `C2M_EDDM_PAPER_TYPE` | `White Matte` |
| `C2M_EDDM_BILLING_TYPE` | `User Credit` |
| `C2M_EDDM_JOB_TEMPLATE` | empty. Set this to the template name from the staging site. |

### The address block

Downloaded Oct 26, 2026:

- https://templates.click2mail.com/every-door-direct-mail/6.5x9
- https://templates.click2mail.com/every-door-direct-mail/6.25x11

The 6.5×9 page is 9.5 by 7 inches. The 6.25×11 page is 11.5 by 6.75 inches. That is 0.25 inches of bleed on every side of a 9×6.5 and an 11×6.25 trim. On both backs the white address block is **4 inches wide and 2 inches tall**, flush to the bottom-right corner of the trim. The old USPS guess (a 1.625 by 1.375 inch stamp zone at the top-right, and a 3.4 by 0.8 inch Postal Customer line) is not what the template shows. The numbers live in `lib/print-spec/click2mail-reserved-zones.ts`.

David at Click2Mail is still confirming the 5×8 and 6×9 reserved boxes. Those current numbers are in the same file. The published 5×8 catalog version is not edited from that file.

## What is still unverified

- Whether commercial use of `https://gis.usps.com/arcgis/rest/services/EDDM/selectZIP/GPServer/routes/execute` is allowed. The feed is public and undocumented. It returned routes for ZIP 10001 during development.
- Which mail-class string is full service with the Click2Mail permit. Job 1304272 accepted only `Postage Paid in Advance`.
- Whether `deliveryType` for homes plus businesses should be `All` or another word. Residential alone sends `Residential`.
- The all-in price. The screen shows a postage estimate only.
