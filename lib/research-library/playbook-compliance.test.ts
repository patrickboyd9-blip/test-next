import assert from "node:assert/strict"
import test from "node:test"

import { complianceWarnings, COMPLIANCE_FLAGS, compliantSpecForIndustry, hasBlockedClaim, stripBlockedClaims } from "./compliance"
import { uploadComplianceWarnings } from "@/lib/bring-your-own-design/design-review"
import type { CampaignBrief } from "@/lib/campaign-creator/types"

const ids = (text: string, industry: string, location = "") => complianceWarnings(text, { industry, location }).map((w) => w.id)

const CASES: Array<[string, string, string, string?]> = [
  ["pest-safe-claim", "pest-control", "Pet-safe treatments for your home"],
  ["pest-epa-claim", "pest-control", "EPA approved products"],
  ["cleaning-disinfect", "cleaning-pressure-washing", "We disinfect every surface"],
  ["ca-contractor-license", "home-remodeling", "Kitchen remodels. Call 555-0100", "San Diego, CA 92101"],
  ["ca-contractor-license", "handyman", "Small jobs done right", "Fresno, California"],
  ["ca-insurance-license", "home-insurance", "Save on home insurance", "Irvine, CA"],
  ["free-with-purchase", "roofing", "FREE gutters with any roof replacement"],
  ["moving-dot-number", "moving-storage", "Local moves from $299"],
  ["moving-cal-t", "moving-storage", "Local moves. USDOT 1234567", "Oakland, CA"],
  ["fair-housing", "real-estate-agents", "Perfect for young families in a safe neighborhood"],
  ["cash-buyer-urgent", "home-buying", "URGENT: We buy houses for cash"],
  ["reg-z-trigger", "mortgage-financial", "Only $1,299/month with 3% down"],
  ["medicare-2027", "medicare", "Get the best plan and a $50 grocery card"],
  ["reg-z-trigger", "auto", "$0 down, 72 months"],
  ["reg-m-lease", "auto", "Lease a new sedan for $249"],
  ["body-shop-deductible", "auto", "We'll pay your deductible"],
  ["dental-fee-disclosure", "dental", "$79 new patient exam"],
  ["med-spa-botox", "med-spa-chiro", "Botox $10 a unit"],
  ["gym-auto-renew", "gyms-fitness", "Join for $19 a month"],
  ["retail-sweepstakes", "retail-grand-openings", "Enter to win a TV at our grand opening"],
  ["roofing-tax-credit", "roofing", "Claim the federal tax credit on a new roof"],
  ["hvac-r410a", "hvac", "R-410A is banned. Replace now"],
  ["vet-specialist", "vet-pet", "The best vet in town"],
  ["tutoring-results", "tutoring-childcare", "Guaranteed results on the SAT"],
  ["church-political", "churches-community", "Vote for our candidate"],
  ["precious-metals-guarantee", "precious-metals", "Risk-free gold with guaranteed returns"],
  ["salon-guarantee", "hair-salon", "Color that lasts forever"],
  ["laundromat-eco", "laundromat", "Eco-friendly wash and fold"],
  ["garage-door-license", "garage-doors", "Licensed garage door pros"],
  ["bakery-allergen", "bakery", "Gluten-free cakes"],
  ["optometry-exam-free", "optometry", "Free eye exam with frames"],
]

for (const [id, industry, text, location] of CASES) {
  test(`compliance flag ${id} fires for ${industry}: "${text}"`, () => {
    assert.ok(ids(text, industry, location).includes(id), `${id} missing from ${ids(text, industry, location).join(",")}`)
  })
}

test("flags stay in their own trade", () => {
  assert.ok(!ids("Pet-safe and family-safe", "roofing").includes("pest-safe-claim"))
  assert.ok(!ids("We disinfect", "plumbing").includes("cleaning-disinfect"))
  assert.ok(!ids("Kitchen remodels", "home-remodeling", "Austin, TX").includes("ca-contractor-license"))
})

test("required numbers clear the flag when printed", () => {
  assert.ok(!ids("Remodels. CSLB Lic. #1045678", "home-remodeling", "San Diego, CA").includes("ca-contractor-license"))
  assert.ok(!ids("Moves. USDOT 1234567 CAL-T 190123", "moving-storage", "Oakland, CA").includes("moving-cal-t"))
  assert.ok(!ids("Loans with NMLS #123456. Equal Housing Opportunity", "mortgage-financial").includes("mortgage-nmls"))
})

test("every warning is plain language, not a citation dump", () => {
  for (const flag of COMPLIANCE_FLAGS) {
    assert.ok(flag.message.length < 330, flag.id)
    assert.ok(!/\bCFR\b|\bUSC\b|§/.test(flag.message), `${flag.id} cites law codes`)
  }
})

test("generation strips blocked claims and keeps the rest", () => {
  assert.equal(stripBlockedClaims("Fewer ants this summer. Pet-safe and green.", "pest-control"), "Fewer ants this summer.")
  assert.ok(hasBlockedClaim("Non-toxic pest control", "pest-control"))
  const spec = compliantSpecForIndustry({ headline: "Deep clean your home", body: "We disinfect everything. Book now.", offer: "$50 off" }, "cleaning-pressure-washing")
  assert.equal(spec.body, "Book now.")
})

test("upload review turns printed words into owner warnings", () => {
  const brief = { offer: "$100 off", goal: "Pest control", businessInfo: { name: "Bug Busters Pest Control", city: "Dallas" } } as unknown as CampaignBrief
  const warnings = uploadComplianceWarnings("Bug Busters Pest Control. Pet-safe, EPA approved treatments. $100 off.", brief)
  assert.ok(warnings.some((w) => /safe/.test(w)))
  assert.ok(warnings.some((w) => /EPA/.test(w)))
  assert.deepEqual(uploadComplianceWarnings("", brief), [])
})
