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

Click2Mail answered on Oct 26, 2026. Every Door is a full-service job: **PM EDDM (Full Service): includes the Click2Mail permit**. We do not build a bring-your-own-permit flow, and we do not send the customer's USPS account id.

The customer pays Modern Mail first. Nothing is sent to Click2Mail until that payment is recorded (`campaign.payment.status` is `paid`). Checkout itself is a separate branch. On staging only, `C2M_EDDM_ASSUME_PAID=true` lets an operator run one job before that checkout exists. Production ignores the flag.

Click2Mail recommends a job template made in the staging site. Set its name in `C2M_EDDM_JOB_TEMPLATE`. If that is empty, the order sends the product strings below. The host is staging (`https://stage-rest.click2mail.com/molpro`) unless `C2M_BASE_URL` overrides it. Production Every Door is refused even when production mail is otherwise allowed.

A paid staging order, with `C2M_EDDM_SUBMIT=true`, does this:

1. `POST /documents` with the print PDF. The address block on that PDF is blank.
2. `POST /jobs/jobTemplate` when a template name is set, then `POST /jobs/{id}/update` with the document id and the piece count. Otherwise `POST /jobs` with the product strings, a quantity, and no address list.
3. `POST /jobs/{id}/eddmInfo` with `mailerName`, `mailerAddress1`, `mailerCity`, `mailerState`, `mailerPostalcode`, and `mailerPhone`.
4. `POST /jobs/{id}/eddmRoute` once per route. The route value is the ZIP plus the route id, such as `10001-C071`.
5. `POST /jobs/{id}/eddmPo` once per delivering post office, with the facility name, city, state, ZIP, piece count, `deliveryType`, and `routeType`.
6. `POST /jobs/{id}/submit` with billing type `Invoice`.

Sign-in uses `C2M_STAGE_USERNAME` and `C2M_STAGE_PASSWORD`. If those are empty, staging falls back to `C2M_USERNAME` and `C2M_PASSWORD`.

The delivering post office comes from the USPS route feed (`FACILITY_NAME`, plus city and state from `CITY_STATE`). If a selected route has no facility name, or no city and state, checkout stops with a plain-English message and Click2Mail is not called. The feed has no street, phone, or hours, so those are left off.

Product strings, until a live staging job confirms them:

| Variable | Default |
|---|---|
| `C2M_EDDM_CLASS_6_5X9` | `EDDM Mailer 6.5 x 9` |
| `C2M_EDDM_CLASS_6_25X11` | `EDDM Mailer 6.25 x 11` |
| `C2M_EDDM_MAIL_CLASS` | `PM EDDM (Full Service): includes the Click2Mail permit` |
| `C2M_EDDM_LAYOUT` | `We Prep and Mail` |
| `C2M_EDDM_PAPER_TYPE` | `White Matte` |
| `C2M_EDDM_BILLING_TYPE` | `Invoice` |
| `C2M_EDDM_JOB_TEMPLATE` | empty. Set this to the template name from the staging site. |

### The address block

Downloaded Oct 26, 2026:

- https://templates.click2mail.com/every-door-direct-mail/6.5x9
- https://templates.click2mail.com/every-door-direct-mail/6.25x11

The 6.5×9 page is 9.5 by 7 inches. The 6.25×11 page is 11.5 by 6.75 inches. That is 0.25 inches of bleed on every side of a 9×6.5 and an 11×6.25 trim. On both backs the white address block is **4 inches wide and 2 inches tall**, flush to the bottom-right corner of the trim. The old USPS guess (a 1.625 by 1.375 inch stamp zone at the top-right, and a 3.4 by 0.8 inch Postal Customer line) is not what the template shows. The numbers live in `lib/print-spec/click2mail-reserved-zones.ts`.

David at Click2Mail is still confirming the 5×8 and 6×9 reserved boxes. Those current numbers are in the same file. The published 5×8 catalog version is not edited from that file.

## What is still unverified

- Whether commercial use of `https://gis.usps.com/arcgis/rest/services/EDDM/selectZIP/GPServer/routes/execute` is allowed. The feed is public and undocumented. It returned routes for ZIP 10001 during development.
- A live staging job. This environment has no `C2M_STAGE_USERNAME` or `C2M_STAGE_PASSWORD`, so no job was submitted. The calls above are covered by mocked responses.
- Whether staging accepts the mail-class string, the document class `EDDM Mailer 6.5 x 9` / `EDDM Mailer 6.25 x 11`, the route form `10001-C071`, and an `eddmPo` call that has no street and no phone.
- Whether `deliveryType` for homes plus businesses should be `All` or another word. Residential alone sends `Residential`.
- The all-in price. The screen shows a postage estimate only.
