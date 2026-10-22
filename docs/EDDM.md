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
- The address side reserves the indicia in the top-right zone (1.625 in from the right, 1.375 in from the top, with 1/8 in of clearance) and prints **POSTAL CUSTOMER** to its left. The indicia wording on the file is **ECRWSS / EDDM RETAIL**.
- Copy speaks to the neighborhood. A line such as "Dear Jane" is rewritten before it is printed.

Two templates start on these sizes: **Neighborhood coupon** (6.5×9) and **Neighborhood inspection** (6.25×11). Medicare is refused for Every Door, because the piece cannot pick out a person turning 65.

If the USPS feed is down, the last saved routes for that ZIP are shown, with a note that they were saved earlier. If nothing has been saved, the screen says to try again and the rest of the app keeps working.

## Click2Mail

The order path can create a document, create a job with a quantity and no address list, then call:

- `POST /jobs/{id}/eddmInfo` with the business name, address, and phone
- `POST /jobs/{id}/eddmRoute` once per route (`poName`, `route`, `postalCode`, `totalPieces`)
- `POST /jobs/{id}/eddmPo` once per post office (`name`, `address`, `totalPieces`)
- `POST /jobs/{id}/update` with `crid` and `quantity`

**This has not been run against Click2Mail staging.** The public reference pages were blocked from this environment, and the product names are not published. Live submit stays off unless all of these are true:

- `C2M_ENV=stage` (production is refused even if the flag is set)
- `C2M_USERNAME` and `C2M_PASSWORD`
- `C2M_EDDM_CRID` — the USPS account id sent as `crid`. Whether Click2Mail wants your Mailer ID, the customer's, or theirs is **not confirmed**.
- `C2M_EDDM_SUBMIT=true`

Until that flag is on, the print & mail screen explains why and does not call Click2Mail.

Guessed product strings, until Click2Mail confirms them:

| Variable | Default |
|---|---|
| `C2M_EDDM_CLASS_6_5X9` | `Postcard 6.5 x 9` |
| `C2M_EDDM_CLASS_6_25X11` | `Postcard 6.25 x 11` |
| `C2M_EDDM_MAIL_CLASS` | `Standard Mail` |

The post office street address and hours are not in the USPS route feed. The order sends the facility name and the city/ZIP. Hours are omitted.

## What is still unverified

- Whether commercial use of `https://gis.usps.com/arcgis/rest/services/EDDM/selectZIP/GPServer/routes/execute` is allowed. The feed is public and undocumented. It returned routes for ZIP 10001 during development (counts, age, income, household size, and web-mercator lines).
- Click2Mail EDDM product names, bleed, and whether they print the indicia on top of ours.
- Which value belongs in `crid`.
- The all-in price. The screen shows a postage estimate only.
- A full staging order from document create through submit.
