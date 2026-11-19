# Modern Mail for Canva

Design a 5×8 or 6×9 postcard, front and back, then send the print file to a Modern Mail campaign.

The page is the full print file, including 0.25 in of bleed: 8.5×5.5 in (2550×1650 pixels) or 9.5×6.5 in (2850×1950 pixels) at 300 pixels per inch. Guide marks are taken off the design before the PDF is made, then put back.

## Try the panel on your computer

Open `plugins/canva/preview.html` in a browser. Create the front and the back, then check the size line.

The live app uses `plugins/canva/src/host.js`. A Canva starter passes the design tools into `createHost`.

## What you do to publish it

1. Create a free Canva account, if you do not have one.
2. Open the Canva developer portal and create an app. This does not require a paid plan.
3. On your computer, in that app's starter folder, run the Canva CLI once so the starter exists. Copy `src/host.js` and `src/canva-entry.js` into it.
4. In the developer portal, turn on the two permissions in `manifest.json`: read the design, and write the design. The app has to write pages, so it is not an export-only app.
5. Add a support email and a privacy note that says the token is sent only to Modern Mail to save the postcard.
6. Submit the app for review. Canva usually takes one to three weeks.

No developer account was created from this project, and the app was not submitted.
