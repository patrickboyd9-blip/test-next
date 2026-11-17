# Feature parity

Checked against production `e7832ef` and the cockpit preview in demo mode. Each row was opened in the browser. A status is only Works, Broken, or Missing. Advanced is a fine place for a tool when the click reaches it.

Preview campaigns use the id `preview-demo`, so a cold server can still open the editor. An uploaded postcard stays in the browser, so a missing disk or Blob store does not leave a blank proof.

| Feature | Where you click | Status | What you get |
| --- | --- | --- | --- |
| Home and sample mailers | Home | Works | Sample account, Jordan's Plumbing, and four sample mailers. No invented reply rate. |
| Campaign list | Home, Mailers in progress | Works | Proof ready, printing, in the mail, and delivered. Each opens a status page. |
| New mailer | New mailer | Works | Chat with Comet, upload, template, and team design. |
| Comet introduction | Home `?intro=1` in demo | Works | The first-login card, with Let's go and Look around first. |
| Chat with Comet | New mailer, Chat with Comet | Works | Comet asks follow-ups and does not call a paid model in demo. |
| Ask Comet | Button on every app page | Works | Slide-over help. On a proof it sits on the left so it does not cover the address. It does not mail, approve, or charge. |
| Comet confidentiality | Ask Comet, "Which printer do you use?" | Works | Sample answer. Trusted commercial partners. No vendor, prompt, or cost. |
| Upload PNG, JPG, or PDF | New mailer, Upload my own design | Works | Front and back show immediately and again on the proof. |
| Fit on the postcard | Same proof | Works | The file sits in the frame. The back shows the address, postage, and barcode area. |
| Bad upload | Same step, empty or wrong file | Works | A clear error. The proof is not left blank. |
| Logo | Chat with Comet, Add a logo, and the full editor | Works | A PNG or JPG shows on the proof. The editor still saves a logo. |
| Start from a template | New mailer, then an industry | Works | Industry filters and offer fields. |
| Team design | New mailer, Have our team design it | Works | The request form. Nothing is emailed. |
| Design request list | Advanced, Design requests | Works | Empty state says nothing is emailed. |
| Full editor | Advanced, Full editor | Works | Opens `preview-demo` with Strategy, Creative, Audience, Quantity, and Launch. |
| Design templates, 5×8 and 6×9 | Advanced, Templates | Works | Both sizes, bleed called out, PDF and overlay downloads. |
| Proof | New mailer, Proof | Works | The card, or the uploaded files, before any price. |
| Full price | New mailer, To | Works | Placeholder full price. Not postage by itself. Nothing is charged. |
| Address list | New mailer, To | Works | Two sample lists and a CSV count. |
| Evidence guidance | Full editor, Guidance | Works | Comet states when guidance is limited and does not invent an offer. |
| Job photos | Full editor, Job photos | Works | Up to five photos. |
| Keep in frame | Job photos, drag the box | Works | The box is what must stay on the card. |
| Words-only back | Job photos, Back of the card | Works | Words only. The front photo stays. |
| Follow-up proposal | Full editor, Follow-up | Works | Unsold-estimate proposal. Sending is off. |
| Campaign history | Full editor, History | Works | Finished steps only. No fake response rate. |
| List review and checkout | Full editor, Review list and checkout | Works | Checkout stays closed until a proof, a list, and a price exist. No charge and no mail. |
| Approve and mail | New mailer, Approve & mail | Works | Saves a preview only. Nothing is mailed or charged. |
