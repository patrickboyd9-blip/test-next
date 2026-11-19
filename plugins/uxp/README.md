# Modern Mail for Photoshop and InDesign

One plugin makes a 5×8 or 6×9 postcard, front and back, in either app, then sends the print file to a Modern Mail campaign.

The page is the full print file, including 0.25 in of bleed: 8.5×5.5 in or 9.5×6.5 in, at 300 pixels per inch. Guide marks sit on a locked layer. That layer is hidden while the PDF is saved. In InDesign it is also marked not printable, so it stays out of the file.

## Try the panel on your computer

Open `plugins/uxp/index.html` in a browser to see the panel and the page sizes.

To try it inside the apps, install the free UXP Developer Tool, add this folder, and load it. The manifest lists both apps so one folder loads in each while you are developing.

## What you do to publish it

1. Create a free Adobe ID, if you do not have one.
2. Install Photoshop and InDesign from Creative Cloud. Those apps are a paid subscription. The developer account that submits the plugin is free.
3. Install the UXP Developer Tool and load this folder in each app.
4. The public store packages one app at a time. Submit the same plugin twice. For the Photoshop listing, set `host` to only `{ "app": "PS", "minVersion": "24.2.0" }`. For the InDesign listing, set `host` to only `{ "app": "ID", "minVersion": "18.5.0" }`. Keep the same plugin id within each listing.
5. Add a support email and a privacy note that says the token is sent only to Modern Mail to save the postcard.
6. Submit each listing. Review is usually two to four weeks.

No developer account was created from this project, and nothing was submitted.
