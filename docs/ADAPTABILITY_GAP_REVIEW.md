# Adaptability gap review

Checked against [Perpetual Adaptability](PERPETUAL_ADAPTABILITY.md) on main (`e7832ef`). This is a reading of the current code, not a new feature.

What is already adaptable

- Creative generation can run through a provider boundary, with a mock when no model key is set.
- Campaign documents are stored behind one store that can be files or Postgres.
- Print geometry lives in the catalog, separate from the creative prompt.

What is still closed

- There is no versioned customer or agent API. The workflows run as server actions inside the app.
- Approve, send, and charge are not a single permissioned tool surface. A later branch starts that as one internal module, still not an external API.
- Some prompts name a specific model provider. The abstraction exists, and the prompt text still assumes one vendor in places.
- Research notes and taste guidance sit in the repo. They are not exposed, and they are also not behind a replaceable interface.

What stays protected

- Customer campaigns, lists, and proofs are not a public dataset.
- Pricing stays the full price the customer sees. Internal cost is not a product surface.
- Print-vendor credentials stay in the environment and are not written into the creative prompt.
