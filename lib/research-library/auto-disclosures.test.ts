import assert from "node:assert/strict"
import test from "node:test"

import { complianceWarnings } from "./compliance"
import { DENTAL_FEE_DISCLAIMER, EQUAL_HOUSING_MARK, withRequiredDisclosures } from "./auto-disclosures"
import { industryForBrief } from "./industry"

const check = (brief: any, printed: string) => {
  const legal = withRequiredDisclosures({ brief, printedText: printed })
  const text = [printed, legal.complianceMark, legal.disclaimer].filter(Boolean).join(" ")
  return { legal, warnings: complianceWarnings(text, { industry: industryForBrief(brief, printed), offer: brief.offer }) }
}

test("real estate cards get Equal Housing Opportunity and pass the check", () => {
  const brief = { goal: "Get listing appointments", offer: "Free home value report", businessInfo: { name: "Lane Realty", license: "DRE #01234567", city: "Austin", state: "TX" } }
  const { legal, warnings } = check(brief, "What is your home worth? Free home value report")
  assert.match(legal.complianceMark ?? "", new RegExp(EQUAL_HOUSING_MARK))
  assert.equal(warnings.filter((w) => w.id === "equal-housing").length, 0)
})

test("dental fee offers get the patient-rights notice and pass the check", () => {
  const brief = { goal: "New dental patients", offer: "$59 new patient exam and cleaning", businessInfo: { name: "Bright Smile Dental", city: "Tampa", state: "FL" } }
  const { legal, warnings } = check(brief, "$59 new patient exam, x-rays and cleaning at our dental office")
  assert.equal(legal.disclaimer, DENTAL_FEE_DISCLAIMER)
  assert.equal(warnings.filter((w) => w.id === "dental-fee-disclosure").length, 0)
})

test("lenders get Equal Housing and their NMLS ID only when the brief has one", () => {
  const brief = { goal: "Refinance leads for mortgage loans", offer: "Free refinance review", businessInfo: { name: "Oak Mortgage", license: "NMLS #123456" } }
  const { legal } = check(brief, "Free mortgage refinance review")
  assert.match(legal.complianceMark ?? "", /Equal Housing Opportunity/)
  assert.match(legal.complianceMark ?? "", /NMLS #123456/)
  const none = withRequiredDisclosures({ brief: { ...brief, businessInfo: { name: "Oak Mortgage" } }, printedText: "Free mortgage refinance review" })
  assert.doesNotMatch(none.complianceMark ?? "", /NMLS/)
})

test("trades without required lines get nothing added", () => {
  const legal = withRequiredDisclosures({ brief: { goal: "Roof repair leads", offer: "$500 off a new roof" } as any, printedText: "$500 off a new roof" })
  assert.equal(legal.disclaimer, undefined)
  assert.equal(legal.complianceMark, undefined)
})
