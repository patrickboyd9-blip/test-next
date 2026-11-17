# Feature parity

Checked against the production app at `e7832ef` and the PR60 preview in demo mode. Each row was opened in the browser. Advanced is a fine place for a tool, as long as the click reaches it.

Preview campaigns live in the server process under the id `preview-demo`, so a cold start can still open the editor. Uploaded postcard files are also kept in the browser, so a missing disk or Blob store does not leave a blank proof.

| Feature | Where you click | Status |
| --- | --- | --- |
| Home and sample mailers | Home | Works. The sample account and four sample mailers are on the page. |
| New mailer, four start paths | New mailer | Works. Chat with Comet, upload, template, and team design are all there. |
| Upload a PNG, JPG, or PDF and see the proof | New mailer, Upload my own design | Works. The front and the back show on the upload step and again on the proof. A bad file shows an error instead of a blank card. |
| Fit the file on the postcard | Same proof | Works. The file sits inside the postcard frame, with the trim line and the address area drawn on the back. |
| Logo on the card | Chat with Comet, Add a logo, and the full editor | Works. A PNG or JPG shows on the proof. The full editor still has the saved logo control. |
| Start from a template | New mailer | Works. Industry filters and the offer fields are on the step. |
| Ask the team to design it | New mailer, and Advanced, Design requests | Works. The form is on the start path. The list page opens and says nothing is emailed. |
| Full editor | Advanced, Full editor | Works. Preview opens campaign `preview-demo` with Strategy, Creative, Audience, Quantity, and Launch. |
| Design templates for 5×8 and 6×9 | Advanced, Templates | Works. Both sizes offer a download, with bleed called out. |
| Proof and full price before mailing | New mailer, through Proof and To | Works. The placeholder full price is shown, and Approve & mail only saves a preview. |
| Address list | New mailer, To | Works. Two sample lists and a CSV upload that counts people. |
| Evidence guidance | Full editor, Guidance | Works. Comet shows the limited-guidance note and does not invent an offer. |
| Job photos, keep-in-frame, words-only back | Full editor, Job photos | Works. The page lets you drag what must stay in the card, and offers “Words only” for the back. |
| Follow-up proposal | Full editor, Follow-up | Works. The unsold-estimate proposal is on the page and says sending is off. |
| Campaign history | Full editor, History | Works. The page lists only finished steps and shows no fake results. |
| List review and checkout | Full editor, Review list and checkout | Works. Checkout stays closed until a proof, a list, and a price exist. It says it does not charge or mail. |
| Ask Comet | Button on every page | Works. The help button is on the pages above. |
