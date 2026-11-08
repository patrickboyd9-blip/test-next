/**
 * Records copied from the reviewed library files in this repo.
 * A citation is usable only when its URL and anchor still appear in that file.
 * Dates are the dates the file states. They are not a new access check.
 */

export interface ReviewedSource {
  id: string
  trade: "roofing" | "hvac" | "general"
  title: string
  url: string
  file: string
  /** A phrase that must appear in that file. */
  anchor: string
  documentDate: "2026-10-20"
  campaignWhen: string | null
  evidenceType: "documented-campaign" | "psychology-paper"
  /** What this record is allowed to support. */
  supports: string
  limitation: string
}

export const REVIEWED_SOURCES: readonly ReviewedSource[] = [
  {
    id: "library-roofing-owens-pink",
    trade: "roofing",
    title: "Owens Corning Roofing: Pink Panther spots",
    url: "https://www.youtube.com/watch?v=6jy9F9Ynl8E",
    file: "lib/design-intelligence/ad-psych/campaign-library.md",
    anchor: "no verified results found for the roofing spots",
    documentDate: "2026-10-20",
    campaignWhen: "Pink Panther used since 1980; roofing spot published 2018",
    evidenceType: "documented-campaign",
    supports: "A roofing brand repeated one character and one color so a later ad could be recognized.",
    limitation: "The library found no verified results for those roofing spots. This is TV and online video, not a postcard test, and it is not a response rate.",
  },
  {
    id: "library-roofing-roof-smarter",
    trade: "roofing",
    title: "Owens Corning Roofing: Roof Smarter and Roof Gawking",
    url: "https://interruptdelivers.com/work/owens-corning-roofing/homeowner-marketing",
    file: "lib/design-intelligence/ad-psych/campaign-library.md",
    anchor: "homeowners scout their neighbors' roofs",
    documentDate: "2026-10-20",
    campaignWhen: null,
    evidenceType: "documented-campaign",
    supports: "That campaign treated the roof as something a homeowner could picture on the house, not only as a product spec.",
    limitation: "The library marks the impression and view counts as an unverified agency claim. Those numbers are not repeated here and are not your mailing's result.",
  },
  {
    id: "library-roofing-atlas-hp42",
    trade: "roofing",
    title: "Atlas Roofing: HP42 launch",
    url: "https://trustworkz.com/blog/2019/03/21/trustworkz-and-atlas-roofing-win-gold-for-hp42-product-launch/",
    file: "lib/design-intelligence/ad-psych/campaign-library.md",
    anchor: "Hanley Wood's 2018 Gold Brand Builder Award",
    documentDate: "2026-10-20",
    campaignWhen: "2018",
    evidenceType: "documented-campaign",
    supports: "The library records a memorable headline plus contractor quotes for a product launch aimed at contractors.",
    limitation: "Reach figures are marked an unverified agency claim. The audience was contractors on social, not a homeowner postcard test.",
  },
  {
    id: "library-hvac-carrier",
    trade: "hvac",
    title: "Carrier: Turn to the Experts",
    url: "https://www.carrier.com/residential/en/us/about-carrier/",
    file: "lib/design-intelligence/ad-psych/campaign-library-extra.md",
    anchor: "Turn to the Experts",
    documentDate: "2026-10-20",
    campaignWhen: "1990s–present",
    evidenceType: "documented-campaign",
    supports: "The library's confirmed point is that Carrier uses one credential line, and the lesson is to lead with one true credential.",
    limitation: "No published results. An expert or number-one claim needs proof you actually have. This is not legal approval.",
  },
  {
    id: "library-hvac-trane",
    trade: "hvac",
    title: "Trane: It's Hard to Stop a Trane",
    url: "https://www.trane.com/residential/en/resources/blog/press-releases/legacy-innovation-trane-celebrates-century-service/",
    file: "lib/design-intelligence/ad-psych/campaign-library-extra.md",
    anchor: "Trane introduced the tagline in 1992",
    documentDate: "2026-10-20",
    campaignWhen: "1992–present",
    evidenceType: "documented-campaign",
    supports: "The library records a durability demonstration built around one vivid image of the equipment.",
    limitation: "No published results. A dramatized test has to be truthful. This is television, not a postcard response study.",
  },
  {
    id: "library-hvac-energy-star",
    trade: "hvac",
    title: "ENERGY STAR heating and cooling education",
    url: "https://www.energystar.gov/about",
    file: "lib/design-intelligence/ad-psych/campaign-library-extra.md",
    anchor: "EPA reports more than 90% household recognition of the label",
    documentDate: "2026-10-20",
    campaignWhen: "1992–present",
    evidenceType: "documented-campaign",
    supports: "The library says a real certification mark can be shown when you are allowed to use it.",
    limitation: "The file also records an agency recognition figure. That figure is not your mailing's result and is not repeated here. Do not imply you are the government.",
  },
  {
    id: "principle-attention-pieters-2004",
    trade: "general",
    title: "Pieters and Wedel, attention to pictures and text in print ads",
    url: "https://doi.org/10.1509/jmkg.68.2.36.27794",
    file: "lib/design-intelligence/ad-psych/postcard-principles.md",
    anchor: "pictorial elements captured attention independent of size",
    documentDate: "2026-10-20",
    campaignWhen: "2004",
    evidenceType: "psychology-paper",
    supports: "In eye-tracking of print ads, pictures drew attention, and attention to text rose with the area the text covered.",
    limitation: "This is print-ad eye tracking. It is not a postcard response rate and it does not predict how many people will call.",
  },
  {
    id: "principle-outcome-gutman-1982",
    trade: "general",
    title: "Gutman, means-end chain",
    url: "https://doi.org/10.1177/002224298204600207",
    file: "lib/design-intelligence/ad-psych/postcard-principles.md",
    anchor: "means-end chain theory",
    documentDate: "2026-10-20",
    campaignWhen: "1982",
    evidenceType: "psychology-paper",
    supports: "The framework links a product attribute to a benefit and a personal value.",
    limitation: "The library marks this as more descriptive than experimentally tested. It is not a mailing result.",
  },
]

const REJECT = /ignore previous|<\s*script|tool_call|begin system|function\s*\(/i

export function sourceUsable(source: ReviewedSource, fileText: string): { ok: true } | { ok: false; reason: string } {
  if (REJECT.test(fileText) || REJECT.test(source.supports) || REJECT.test(source.title)) {
    return { ok: false, reason: "Source text is stored as data and was rejected." }
  }
  if (!fileText.includes(source.url) || !fileText.includes(source.anchor)) {
    return { ok: false, reason: `The reviewed file no longer contains ${source.id}.` }
  }
  return { ok: true }
}
