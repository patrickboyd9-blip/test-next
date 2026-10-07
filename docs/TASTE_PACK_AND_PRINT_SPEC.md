# Taste pack and 5×8 print spec

A short note for Patrick. This is the bridge spike he approved: Studio-quality creative that starts from real mailers, plus a print file that matches the 5×8 size we already trust. It does not open a Click2Mail account, and it does not mail anything.

## What changed

Campaign Creator can already ask for three postcard directions. Those directions were guided by general rules, not by the mailers in the private research library. The cards could still look like a software mock: badges, pill buttons, and stock that does not know what a real postcard is doing.

This spike does two things.

1. It puts about twenty researched postcards into the product as **Reference Cards**. When someone generates or regenerates a campaign, the live creative engine reads the few cards that match that business. It does not read the raw research files.
2. It can export a **5×8 print-spec file** whose page size, bleed, and address-side keep-outs match the catalog we already locked. The file is a geometry proof at 300 DPI. It is not a finished customer design, and it is not sent to a printer.

## The taste pack

The cards are summarized from `patrickboyd9-blip/modern-mail-research`. That repo stays read-only. We did not copy logos, slogans, or artwork into anything a customer would mail. There were no research photos cleared to ship, so the pack is text: what the piece was doing, not a picture to paste.

Each card has an id (such as MMR-001), a vertical, postcard as the format, the size when the research actually recorded one, three to seven principles, notes on composition, imagery, and the response path, why the pattern works, and how confident the source was.

The mix:

| | Cards | What they teach |
|---|---|---|
| Home services | 10 | HVAC, plumbing, electrical, roofing, pest, landscaping, plus pressure-washing and foundation/chimney pieces that had clearer layout notes than a second HVAC file that only published results |
| Local healthcare | 4 | Dental, med spa, chiropractic, physical therapy |
| Hospitality | 3 | A neighborhood restaurant, pizza, and a jumbo food card aimed at foot traffic |
| Craft | 3 | A quiet premium piece, a jumbo card that must not become a badge farm, and a small jewelry card where bigger is not better |

A roofing campaign sees the roofing card, a couple of related trade cards, and one craft card. A pizza campaign sees the food cards, not the roofing card. A campaign we do not have a vertical for sees only the craft cards, and the prompt says so.

The existing Pexels photos stay the fallback when there is no customer photo. The cards raise the bar for hierarchy and the offer. They are not a new photo library.

The model is told to imitate the craft and not the brand, and not to spend money or submit a print job. The rehearsal engine used when there is no Anthropic key still shows its practice cards. It does not call the model, so those practice cards are not rewritten by this pack. The live generate and regenerate path is the one that reads the cards.

## The 5×8 file

The catalog already says a 5×8 postcard is 8 inches by 5 inches finished, on an 8.5 by 5.5 inch page, because the bleed is 0.25 inches on every side. The address side has two areas that must stay clear: the mailing panel and the barcode strip. This spike does not change that catalog entry.

The export:

- A two-page PDF. Each page is 8.5 by 5.5 inches. The inner box is the 8 by 5 trim. Page 2 draws the address-side keep-outs.
- A PNG of the same guides at 300 DPI, which is 2550 by 1650 pixels.

**Color, said honestly:** these files are RGB. We are not converting them to CMYK. Click2Mail's own design advice says to send CMYK, and an RGB file can shift when it is printed. What this file is built to survive is the size check: the page is the artwork canvas for this product. We are not claiming a color pass, and we are not claiming the vendor's internal product name, because that name is not confirmed in our catalog.

Try it with the app running:

- `http://localhost:3000/api/print-spec/postcard-5x8` downloads the PDF.
- `http://localhost:3000/api/print-spec/postcard-5x8?format=png&face=back` is the raster of the address side. Use `face=front` for the other side.

The lines on the file are guides. They are not a customer's postcard.

## Still not built

- A Click2Mail login, or any API credential
- Creating, proving, or submitting a mail job
- Taking payment
- Buying or uploading a mailing list (including Data Axle)
- Turning the on-screen Studio card into press-ready customer art
- CMYK conversion

Those wait until a later decision. This spike stops at taste and at a size-correct file.
