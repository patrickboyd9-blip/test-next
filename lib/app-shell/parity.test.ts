import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")
}

const features: { name: string; file: string; needle: string }[] = [
  { name: "Home", file: "components/layout/AppSidebar.tsx", needle: 'label: "Command Center", href: "/app"' },
  { name: "New mailer", file: "components/layout/AppSidebar.tsx", needle: 'href="/app/mail"' },
  { name: "Upload my own design", file: "components/cockpit/StartChoices.tsx", needle: "Upload my own design" },
  { name: "Upload proof", file: "components/cockpit/ComposeMailer.tsx", needle: "ProofEditor" },
  { name: "Chat with Comet", file: "components/cockpit/StartChoices.tsx", needle: "Chat with ${ASSISTANT_NAME}" },
  { name: "Use something from the gallery", file: "components/cockpit/StartChoices.tsx", needle: "Use something from the gallery" },
  { name: "Team design request", file: "components/cockpit/ComposeMailer.tsx", needle: "DesignRequestForm" },
  { name: "Full editor", file: "app/app/campaigns/[id]/page.tsx", needle: "Open full editor" },
  { name: "Gallery", file: "components/layout/AppSidebar.tsx", needle: 'label: "Gallery", href: "/app/templates"' },
  { name: "Print Templates", file: "components/layout/AppSidebar.tsx", needle: 'label: "Print Templates", href: "/app/print-templates"' },
  { name: "Design requests", file: "app/app/campaigns/[id]/page.tsx", needle: 'href="/app/design-requests"' },
  { name: "Proof and full price", file: "components/cockpit/ComposeMailer.tsx", needle: "PLACEHOLDER_FULL_PRICE" },
  { name: "List upload", file: "components/cockpit/ComposeMailer.tsx", needle: "countAddresses" },
  { name: "Evidence guidance", file: "app/app/campaigns/[id]/page.tsx", needle: "/guidance" },
  { name: "Job photos", file: "app/app/campaigns/[id]/page.tsx", needle: "/job-photos" },
  { name: "Follow-up", file: "app/app/campaigns/[id]/page.tsx", needle: "/follow-up" },
  { name: "Campaign history", file: "app/app/campaigns/[id]/page.tsx", needle: "/history" },
  { name: "Click2Mail order", file: "app/app/campaigns/[id]/page.tsx", needle: "/order" },
  { name: "Logo upload", file: "components/campaign-creator/LogoUpload.tsx", needle: "type=\"file\"" },
  { name: "Ask Comet", file: "app/app/layout.tsx", needle: "AskComet" },
  { name: "API settings", file: "app/app/settings/page.tsx", needle: 'href="/app/settings/api"' },
]

for (const feature of features) {
  test(`${feature.name} stays reachable`, () => {
    assert.match(source(feature.file), new RegExp(feature.needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  })
}

test("Command Center sits under New Mailer and Reports stays in Manage", () => {
  const sidebar = source("components/layout/AppSidebar.tsx")
  const content = sidebar.slice(sidebar.indexOf("<SidebarContent>"))
  const mailer = content.indexOf("New Mailer")
  const center = content.indexOf("COMMAND_CENTER")
  const create = content.indexOf('label="Create"')
  const manage = content.indexOf('label="Manage"')
  const account = sidebar.indexOf('label="Account"')
  assert.ok(mailer >= 0 && center > mailer)
  assert.ok(create > center)
  assert.ok(manage > create)
  assert.ok(account > manage)
  const manageItems = sidebar.slice(sidebar.indexOf("const MANAGE"), sidebar.indexOf("const ACCOUNT"))
  assert.match(manageItems, /Campaigns/)
  assert.match(manageItems, /Lists/)
  assert.match(manageItems, /label: "Reports", href: "\/app\/reports"/)
  assert.doesNotMatch(manageItems, /Command Center/)
})

test("preview demo still opens the full editor instead of skipping it", () => {
  const page = source("app/app/campaigns/new/page.tsx")
  assert.doesNotMatch(page, /redirect\("\/app\/mail"\)/)
  assert.match(page, /createDraftCampaign/)
})
