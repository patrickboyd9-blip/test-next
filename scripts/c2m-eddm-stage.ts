/**
 * One Click2Mail STAGING Every Door order, paid with User Credit.
 *
 * Does not print the username or password. Refuses production.
 *
 *   C2M_ENV=stage C2M_STAGE_USERNAME=... C2M_STAGE_PASSWORD=... \
 *   C2M_EDDM_CRID=123456789 \
 *   npm run c2m:eddm
 *
 *   npm run c2m:eddm -- --crid 123456789 --template "Modern Mail EDDM 6.5x9" --pieces 400
 *
 * A job template saved in the Click2Mail staging site is the preferred way to
 * name the product. Without C2M_EDDM_JOB_TEMPLATE, the script reads
 * GET /productOptions/advanced and uses those exact strings.
 */
import { createClick2MailClient } from "../lib/click2mail/client"
import { loadClick2MailConfig } from "../lib/click2mail/config"
import { runStagingEddmOrder } from "../lib/click2mail/eddm-stage-run"
import { isEddmSize, type EddmSize } from "../lib/eddm/geometry"
import { loadEddmRoutes } from "../lib/eddm/usps"
import { deliveringPostOfficeIssues, snapshotRoute } from "../lib/eddm/routes"
import { normalizeUspsCrid } from "../lib/eddm/usps-crid"
import { readRememberedUspsCrid } from "../lib/eddm/usps-crid-store"
import { renderTemplatedPostcardPdf } from "../lib/print-spec/render-template-postcard-pdf"

function printHelp(): void {
  console.log(`Usage: npm run c2m:eddm -- [flags]

Sends one Full Service Every Door order to Click2Mail staging and pays with User Credit.
Prints the job id, status, and cost. Does not print sign-in values.

  --crid 123456789     USPS CRID. Or set C2M_EDDM_CRID. Saved app value is used if both are empty.
  --template "name"    Job template from the Click2Mail staging site. Or C2M_EDDM_JOB_TEMPLATE.
  --size 6.5x9|6.25x11 Default 6.5x9
  --zip 10001          Default 10001
  --route C071         Default C071
  --pieces 400         Piece count for this staging check. Default 400, so it can fit a few hundred dollars of credit.

The mailer name and address come from C2M_EDDM_MAILER_NAME, C2M_EDDM_MAILER_STREET,
C2M_EDDM_MAILER_CITY, C2M_EDDM_MAILER_STATE, C2M_EDDM_MAILER_ZIP, and C2M_EDDM_MAILER_PHONE.
They default to a staging sample.
`)
}

function readFlag(argv: string[], name: string): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? ""
    if (token === `--${name}`) return argv[index + 1]
    if (token.startsWith(`--${name}=`)) return token.slice(name.length + 3)
  }
  return undefined
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp()
    return
  }
  const config = loadClick2MailConfig()
  if (config.environment !== "stage" || !config.baseUrl.includes("stage-rest.click2mail.com")) {
    console.error("This script only talks to Click2Mail staging. Production is not called.")
    process.exitCode = 1
    return
  }
  if (!config.username || !config.password) {
    console.error("Set C2M_STAGE_USERNAME and C2M_STAGE_PASSWORD. They are not printed.")
    process.exitCode = 1
    return
  }

  const sizeArg = readFlag(argv, "size") ?? "6.5x9"
  if (!isEddmSize(sizeArg)) {
    console.error("Size must be 6.5x9 or 6.25x11.")
    process.exitCode = 1
    return
  }
  const size: EddmSize = sizeArg
  const crid =
    normalizeUspsCrid(readFlag(argv, "crid") ?? process.env.C2M_EDDM_CRID) ??
    (await readRememberedUspsCrid())
  if (!crid) {
    console.error("Set --crid or C2M_EDDM_CRID. Full Service Every Door is held without a USPS CRID.")
    process.exitCode = 1
    return
  }

  const zip = (readFlag(argv, "zip") ?? "10001").trim()
  const routeId = (readFlag(argv, "route") ?? "C071").trim().toUpperCase()
  const requestedPieces = Number(readFlag(argv, "pieces") ?? "400")
  const loaded = await loadEddmRoutes({ query: zip })
  const found = loaded.routes.find((route) => route.route.toUpperCase() === routeId && route.zip === zip)
  if (!found) {
    console.error(loaded.message || `No route ${routeId} in ZIP ${zip}.`)
    process.exitCode = 1
    return
  }
  const pieces = Math.min(
    Number.isFinite(requestedPieces) && requestedPieces > 0 ? requestedPieces : found.residential,
    found.residential
  )
  const snapshot = { ...snapshotRoute(found), residential: pieces, total: pieces + found.business }
  const officeIssue = deliveringPostOfficeIssues([snapshot])[0]
  if (officeIssue) {
    console.error(officeIssue)
    process.exitCode = 1
    return
  }

  const pdf = await renderTemplatedPostcardPdf({
    size,
    templateId: "neighbor_letter",
    copy: {
      headline: "Neighbors",
      body: "A short note for this block.",
      offer: "This week",
      phone: process.env.C2M_EDDM_MAILER_PHONE?.trim() || "212-555-0100",
      businessName: process.env.C2M_EDDM_MAILER_NAME?.trim() || "Modern Mail Staging",
    },
  })

  const client = createClick2MailClient({ config })
  const result = await runStagingEddmOrder({
    client,
    config,
    pdf: pdf.bytes,
    size,
    crid,
    routes: [snapshot],
    templateName: readFlag(argv, "template") ?? undefined,
    mailer: {
      name: process.env.C2M_EDDM_MAILER_NAME?.trim() || "Modern Mail Staging",
      address: process.env.C2M_EDDM_MAILER_STREET?.trim() || "1 Main St",
      city: process.env.C2M_EDDM_MAILER_CITY?.trim() || "New York",
      state: process.env.C2M_EDDM_MAILER_STATE?.trim() || "NY",
      zip: process.env.C2M_EDDM_MAILER_ZIP?.trim() || "10001",
      phone: process.env.C2M_EDDM_MAILER_PHONE?.trim() || "212-555-0100",
    },
  })

  if (result.jobId) console.log(`Job id: ${result.jobId}`)
  console.log(`Status: ${result.jobStatus || "not created"}`)
  console.log(result.cost !== undefined ? `Cost: $${result.cost.toFixed(2)}` : "Cost: unavailable")
  console.log(`Submitted: ${result.submitted ? "yes" : "no"}`)
  console.log(`Pieces: ${pieces}`)
  if (pieces < found.residential) {
    console.log(`The route has ${found.residential} homes. This staging check sends ${pieces} so it can fit the credit on the account.`)
  }
  if (result.error) {
    console.error(result.error)
    process.exitCode = 1
  } else if (!result.submitted) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Staging Every Door order failed."
  console.error(message)
  process.exitCode = 1
})
