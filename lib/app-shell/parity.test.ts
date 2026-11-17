import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")
}

const features: { name: string; file: string; needle: string }[] = [
  { name: "Home", file: "components/layout/AppSidebar.tsx", needle: 'href: "/app"' },
  { name: "New mailer", file: "components/layout/AppSidebar.tsx", needle: 'href: "/app/mail"' },
  { name: "Upload my own design", file: "components/cockpit/StartChoices.tsx", needle: "Upload my own design" },
  { name: "Upload proof", file: "components/cockpit/ComposeMailer.tsx", needle: "ProofFrame" },
  { name: "Chat with Comet", file: "components/cockpit/StartChoices.tsx", needle: "Chat with ${ASSISTANT_NAME}" },
  { name: "Start from a template", file: "components/cockpit/StartChoices.tsx", needle: "Start from a template" },
  { name: "Team design request", file: "components/cockpit/ComposeMailer.tsx", needle: "DesignRequestForm" },
  { name: "Full editor", file: "components/layout/AppSidebar.tsx", needle: 'href: "/app/campaigns/new"' },
  { name: "Templates", file: "components/layout/AppSidebar.tsx", needle: 'href: "/app/templates"' },
  { name: "Design requests", file: "components/layout/AppSidebar.tsx", needle: 'href: "/app/design-requests"' },
  { name: "Proof and full price", file: "components/cockpit/ComposeMailer.tsx", needle: "PLACEHOLDER_FULL_PRICE" },
  { name: "List upload", file: "components/cockpit/ComposeMailer.tsx", needle: "countAddresses" },
  { name: "Evidence guidance", file: "app/app/campaigns/[id]/page.tsx", needle: "/guidance" },
  { name: "Job photos", file: "app/app/campaigns/[id]/page.tsx", needle: "/job-photos" },
  { name: "Follow-up", file: "app/app/campaigns/[id]/page.tsx", needle: "/follow-up" },
  { name: "Campaign history", file: "app/app/campaigns/[id]/page.tsx", needle: "/history" },
  { name: "Click2Mail order", file: "app/app/campaigns/[id]/page.tsx", needle: "/order" },
  { name: "Logo upload", file: "components/campaign-creator/LogoUpload.tsx", needle: "type=\"file\"" },
  { name: "Ask Comet", file: "app/app/layout.tsx", needle: "AskComet" },
]

for (const feature of features) {
  test(`${feature.name} stays reachable`, () => {
    assert.match(source(feature.file), new RegExp(feature.needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  })
}

test("preview demo still opens the full editor instead of skipping it", () => {
  const page = source("app/app/campaigns/new/page.tsx")
  assert.doesNotMatch(page, /redirect\("\/app\/mail"\)/)
  assert.match(page, /createDraftCampaign/)
})
