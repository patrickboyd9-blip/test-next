/**
 * Advertising-compliance rewrites for printed copy (Reg Z trigger terms, FTC "free"
 * guide, warranty wording, and owner-banned claims). Every customer-facing line
 * passes through `compliantLine`; headlines also go through `headlineCompliant`.
 */

const BID_PRICED = /\b(?:roof\w*|shingles?|siding|windows?|re-?roof)\b/i
const FULL_APR = /\bAPR\b[^.]*\b(?:term|months?)\b[^.]*\b(?:down|payment)\b/i

/** Reg Z trigger terms: a monthly payment, a term, or a down payment, without a full APR disclosure. */
export function hasTriggerTerm(text: string): boolean {
  if (FULL_APR.test(text)) return false
  return (
    /\$\s?\d[\d,]*(?:\.\d+)?\s*(?:\/\s*mo\b|a month|per month|monthly)/i.test(text) ||
    /\b\d+\s*(?:-|\s)?months?\b|\bno payments?\b|\bno interest for\b|\b\d+\s*(?:-|\s)?(?:year|yr)s?\s+(?:term|financing|loan)\b/i.test(text) ||
    /\b(?:\$\s?\d[\d,]*|no|zero|\d+%)\s*down\b|\bdown payment\b/i.test(text)
  )
}

/** A rate that does not say APR ("0% financing", "0% interest"). */
function bareRate(text: string): boolean {
  return /\b\d+(?:\.\d+)?%\s*(?:financing|interest|rate)\b/i.test(text) && !/\bAPR\b/i.test(text)
}

function isFinancingLine(text: string): boolean {
  return /\bfinanc\w*|\bpayments?\b|\bmonthly\b|\binterest\b|\bAPR\b|\bdown\b/i.test(text)
}

export function compliantLine(input: string | undefined | null, context = ""): string {
  if (!input) return input ?? ""
  let line = input
  const job = `${line} ${context}`
  // Financing: one allowed line unless the full disclosure is printed.
  if (isFinancingLine(line) && (hasTriggerTerm(line) || bareRate(line))) {
    const rate = line.match(/\b(\d+(?:\.\d+)?)%\s*(?:APR\b)?/i)
    const keepsApr = rate && !hasTriggerTerm(line)
    const sentence = keepsApr ? `${rate![1]}% APR financing available` : "Financing available"
    line = line
      .split(/(?<=[.!?])\s+/)
      .map((part) => (isFinancingLine(part) && (hasTriggerTerm(part) || bareRate(part)) ? `${sentence}.` : part))
      .join(" ")
      .replace(/\.\.+/g, ".")
    if (!/[.!?]$/.test(input.trim())) line = line.replace(/\.$/, "")
  }
  // FTC free guide: no "free X with purchase" on bid-priced jobs.
  if (BID_PRICED.test(job)) {
    line = line.replace(/\bfree\s+([a-z][a-z -]{1,30}?)\s+with\s+(?:any\s+|every\s+|your\s+|a\s+)?(?:purchase|install\w*|replacement|new [a-z]+)\b/gi, (_m, item: string) => `${item.trim()} included`)
    line = line.replace(/\*+(?=\s|$)/g, "")
  }
  // Warranty and guarantee wording.
  line = line.replace(/\bfixed right or it'?s free\b/gi, "fixed right, or we come back at no charge")
  line = line.replace(/\bor it'?s free\b/gi, "or we come back at no charge")
  line = line.replace(/\blifetime (warranty|guarantee)\b(?!\s+(?:on|for|covering)\b)/gi, "limited lifetime $1 on materials for as long as you own the home")
  line = line.replace(/\b(?:100% )?(?:money[- ]back|satisfaction) guarantee[d]?\b/gi, "full-price refund guarantee")
  // Owner-banned claims.
  line = line
    .replace(/\byou have hail damage!?/gi, "Did it hit your roof?")
    .replace(/\bfree insurance replacement\b/gi, "insurance claim help")
    .replace(/\b(?:no[- ]cost|free) solar\b/gi, "solar")
    .replace(/\s*,?\s*(?:plus |and |with )?(?:the )?(?:\d+% )?federal (?:solar )?tax credits?\b[^.]*\.?/gi, "")
    .replace(/\b(?:cut|slash)\w* (?:your )?(?:\w+ )?bills? in half\b/gi, "lower your energy bills")
  // Water heater line.
  if (/\bwater heater\b/i.test(line) && /\bold\b|\bage\b|\byears?\b/i.test(line) && /\?/.test(line)) {
    line = "Is your water heater more than 10 years old?"
  }
  return normalizeQuestion(line.replace(/\s{2,}/g, " ").trim())
}

const QUESTION_START = /^(?:is|are|am|do|does|did|can|could|will|would|should|has|have|had|was|were|how|what|why|when|where|who|which|ready for)\b/i

/** A one-sentence question gets its question mark ("Is Your Roof Ready" becomes "Is Your Roof Ready?"). */
export function normalizeQuestion(line: string): string {
  const trimmed = line.trim()
  if (!trimmed || /[.!?]\s+\S/.test(trimmed) || !QUESTION_START.test(trimmed) || trimmed.endsWith("?")) return line
  return trimmed.replace(/[.!]+$/, "") + "?"
}

/** Headlines carry one service and never financing, terms, or banned claims. */
export function headlineCompliant(headline: string, offer = ""): boolean {
  if (/\bfinanc\w*|\bAPR\b|\bmonthly\b|\bpayments?\b|\b\d+%\s*(?:interest|financing)\b/i.test(headline)) return false
  if (hasTriggerTerm(headline)) return false
  if (/\bfree\b[^.]*\bwith\b[^.]*\bpurchase\b/i.test(headline)) return false
  if (/\bor it'?s free\b|\bmoney[- ]back\b/i.test(headline)) return false
  if (/\blifetime\b/i.test(headline) && !/\blifetime\b\s+(?:\w+\s+)?(?:on|for|covering)\b/i.test(headline)) return false
  const services = ["roof", "gutter", "siding", "window", "solar", "hvac|furnace|air condition|\\bac\\b", "water heater", "plumb|drain|pipe"]
    .filter((s) => new RegExp(s, "i").test(headline))
  if (services.length > 1 && !services.every((s) => new RegExp(s, "i").test(offer))) return false
  return true
}

const SKIP = new Set(["phone", "website", "qrDestination", "visualDirection", "imagePrompt", "layoutHints", "addressSide"])

/** Run every printed string field of a direction's spec through `compliantLine`. */
export function compliantSpec<T extends Record<string, unknown>>(spec: T, context = ""): T {
  const next: Record<string, unknown> = { ...spec }
  for (const [key, value] of Object.entries(spec)) {
    if (SKIP.has(key)) continue
    if (typeof value === "string") next[key] = compliantLine(value, context)
    else if (Array.isArray(value) && value.every((v) => typeof v === "string")) next[key] = value.map((v) => compliantLine(v as string, context))
  }
  return next as T
}

/* -------------------------------------------------------------------------- */
/* Playbook compliance flags (Ad Psych library words_and_claims_to_avoid).     */
/* -------------------------------------------------------------------------- */

export type ComplianceSeverity = "block" | "warn"

export interface ComplianceContext {
  /** Gold industry slug (lib/research-library/industry.ts). */
  industry?: string | null
  /** Free text that may name the state, e.g. the business address. */
  location?: string | null
  /** The offer line, used for conditional checks. */
  offer?: string | null
}

export interface ComplianceFlag {
  id: string
  /** Gold slugs this applies to, or "*" for every trade. */
  industries: readonly string[] | "*"
  severity: ComplianceSeverity
  /** Plain-language warning a small-business owner can act on. */
  message: string
  /** Text the card must not print. */
  banned?: RegExp
  /** Text the card must print when `when` holds. */
  required?: RegExp
  when?: (text: string, ctx: ComplianceContext) => boolean
}

export interface ComplianceWarning {
  id: string
  severity: ComplianceSeverity
  message: string
  match?: string
}

const inCalifornia = (text: string, ctx: ComplianceContext) =>
  /\bCA\b|\bcalifornia\b|\b9[0-6]\d{3}\b/i.test(`${ctx.location ?? ""} ${text}`)
const CA_LICENSE = /\b(?:CSLB|lic(?:ense)?\.?|license\s*(?:no\.?|number|#))\s*#?\s*[0-9A-Z]{6,}\b|\blic\.?\s*#\s*\d{5,}/i

export const COMPLIANCE_FLAGS: readonly ComplianceFlag[] = [
  // Everyone
  {
    id: "free-with-purchase",
    industries: "*",
    severity: "warn",
    banned: /\bfree\b[^.!?]{0,40}\bwith\b[^.!?]{0,30}\b(?:purchase|install\w*|replacement|any|every|order|new|service|signup|sign-up|enrollment)\b/i,
    message:
      "\"FREE ___ with ___\" offers are only allowed if the paid part is at your normal price and the conditions are printed right next to the offer. Spell out what they must buy.",
  },
  {
    id: "government-look-alike",
    industries: "*",
    severity: "block",
    banned: /\b(?:official notice|final notice|important government|government notice|do not discard|time[- ]sensitive document|county records? (?:show|indicate)|IRS notice)\b/i,
    message: "Don't make the card look like a government or official notice. Postal law bars mail that looks like it came from the government.",
  },
  // Pest control
  {
    id: "pest-safe-claim",
    industries: ["pest-control"],
    severity: "block",
    banned: /\b(?:safe|safer|harmless|non-?toxic|nonpoisonous|pet[- ]safe|kid[- ]safe|family[- ]safe|child[- ]safe|eco[- ]friendly|organic|all[- ]natural|green)\b/i,
    message: "Pest control ads can't say treatments are \"safe,\" \"non-toxic,\" \"pet-safe,\" \"organic,\" or \"green.\" Federal and state pesticide rules forbid it, even if the product is mild.",
  },
  {
    id: "pest-epa-claim",
    industries: ["pest-control"],
    severity: "block",
    banned: /\b(?:EPA|state)[- ](?:approved|registered|certified|endorsed)\b/i,
    message: "Don't say \"EPA approved\" or \"EPA registered.\" The EPA doesn't approve pest companies, and the claim is not allowed in ads.",
  },
  {
    id: "pest-free-promise",
    industries: ["pest-control"],
    severity: "warn",
    banned: /\bpest[- ]free\b|\bkills? 100%|\beliminates? all\b|\bbug[- ]free\b/i,
    message: "Promising \"pest-free\" or \"kills 100%\" needs proof and a real re-service guarantee. Say \"fewer pests\" or name your guarantee.",
  },
  // Cleaning
  {
    id: "cleaning-disinfect",
    industries: ["cleaning-pressure-washing", "laundromat"],
    severity: "block",
    banned: /\bdisinfect\w*|\bsaniti[sz]\w*|\bkills? (?:99|germs|viruses|bacteria|mold)|\bgerm[- ]free\b|\bvirus[- ]free\b/i,
    message: "Don't say \"disinfect,\" \"sanitize,\" or \"kills germs.\" Those are pesticide claims under federal law. Say \"deep clean\" instead.",
  },
  // License numbers
  {
    id: "ca-contractor-license",
    industries: ["home-remodeling", "handyman", "roofing", "plumbing", "hvac", "garage-doors", "windows-gutters-siding", "solar", "landscaping"],
    severity: "warn",
    required: CA_LICENSE,
    when: inCalifornia,
    message: "California requires your contractor license number (CSLB #) on every ad. Add \"Lic. #123456\" near your phone number. Handymen without a license can only advertise jobs under $1,000 and can't call themselves contractors.",
  },
  {
    id: "ca-insurance-license",
    industries: ["home-insurance", "auto-insurance", "life-insurance", "medicare"],
    severity: "warn",
    required: /\b(?:CA\s*)?(?:license|lic\.?)\s*(?:no\.?|#)?\s*[0-9A-Z]{7}\b/i,
    when: inCalifornia,
    message: "California requires your insurance license number on print ads. Add \"CA License #0A12345\" near your name.",
  },
  {
    id: "handyman-licensed-claim",
    industries: ["handyman"],
    severity: "warn",
    banned: /\b(?:licensed contractor|fully licensed)\b/i,
    message: "Only say \"licensed\" if you hold the right contractor license for that work. Many handymen work under an exemption that doesn't allow the claim.",
  },
  // Moving
  {
    id: "moving-dot-number",
    industries: ["moving-storage"],
    severity: "warn",
    required: /\b(?:U\.?S\.?\s?)?DOT\s*(?:no\.?|#)?\s*\d{5,}|\bMC\s*#?\s*\d{5,}|\bCAL[- ]?T\s*#?\s*\d+/i,
    message: "Movers must print their U.S. DOT number (interstate) or California CAL-T permit number. Add it near your phone number.",
  },
  {
    id: "moving-cal-t",
    industries: ["moving-storage"],
    severity: "warn",
    required: /\bCAL[- ]?T\s*#?\s*\d+/i,
    when: inCalifornia,
    message: "California movers must show their CAL-T permit number on every ad. Advertising without it is against state law.",
  },
  // Real estate and cash buyers
  {
    id: "fair-housing",
    industries: ["real-estate-agents", "home-buying", "mortgage-financial"],
    severity: "block",
    banned: /\b(?:perfect|ideal|great) for (?:young )?(?:families|couples|singles|seniors|retirees|kids)\b|\bno (?:kids|children|section 8)\b|\badults? only\b|\bexclusive (?:neighborhood|community)\b|\bsafe (?:neighborhood|area|community)\b|\bchristian\b|\bwalking distance to (?:church|temple|mosque|synagogue)\b/i,
    message: "Fair Housing rules: don't describe who a home or neighborhood is \"for\" (families, singles, seniors), or call an area \"safe\" or \"exclusive.\" Describe the home, not the people.",
  },
  {
    id: "equal-housing",
    industries: ["real-estate-agents", "mortgage-financial"],
    severity: "warn",
    required: /\bequal housing\b/i,
    message: "Add the Equal Housing Opportunity logo or words. Most brokerages and lenders require it on every mailer.",
  },
  {
    id: "cash-buyer-urgent",
    industries: ["home-buying"],
    severity: "block",
    banned: /\bURGENT\b|\bimmediate response required\b|\bpast due\b|\bforeclosure notice\b|\bofficial\b|\bseal\b|\bcounty\b[^.]{0,20}\bnotice\b/,
    message: "\"We buy houses\" cards can't say URGENT, \"official,\" or look like a county, tax, or foreclosure notice. Postal law treats government look-alikes as nonmailable.",
  },
  // Lending and auto
  {
    id: "reg-z-trigger",
    industries: ["mortgage-financial", "auto", "home-remodeling", "solar", "hvac", "roofing", "windows-gutters-siding", "garage-doors", "precious-metals", "retail-grand-openings", "dental", "med-spa-chiro"],
    severity: "warn",
    when: (text) => hasTriggerTerm(text) || bareRate(text),
    message: "A monthly payment, \"$0 down,\" a loan term, or a rate without \"APR\" triggers Truth in Lending (Reg Z). Print the full APR, down payment, and terms, or just say \"Financing available.\"",
  },
  {
    id: "mortgage-nmls",
    industries: ["mortgage-financial"],
    severity: "warn",
    required: /\bNMLS\s*(?:ID|#)?\s*#?\s*\d{3,}/i,
    message: "Mortgage ads must show your NMLS ID number. Add \"NMLS #123456\".",
  },
  {
    id: "reg-m-lease",
    industries: ["auto"],
    severity: "warn",
    banned: /\blease\b[^.]{0,40}\$\s?\d|\$\s?\d[^.]{0,30}\blease\b|\bdue at signing\b/i,
    message: "Lease prices need Reg M details: say it's a lease, the total due at signing, number of payments, and end-of-lease charges.",
  },
  {
    id: "body-shop-deductible",
    industries: ["auto", "auto-insurance"],
    severity: "block",
    banned: /\b(?:we(?:'ll| will)? (?:pay|cover|waive) (?:your )?deductible|deductible (?:assistance|waiv\w*|rebate|help)|\$\s?\d+ off (?:your )?deductible|no deductible)\b/i,
    message: "Don't offer to pay, waive, or discount the insurance deductible. It's illegal in Texas and treated as possible insurance fraud in other states.",
  },
  // Medicare
  {
    id: "medicare-2027",
    industries: ["medicare"],
    severity: "block",
    banned: /\b(?:medicare|government|CMS|social security)[- ](?:approved|endorsed|official|sponsored)\b|\bofficial medicare\b|\bfree (?:money|benefits|groceries|cash)\b|\bmaximum benefits?\b|\bbest plan\b|\bgiveback\b|\$\s?\d+\s*(?:grocery|gift) card\b/i,
    message: "Medicare marketing (2027 CMS rules): no \"Medicare approved,\" \"official,\" \"free money,\" \"best plan,\" or gift-card promises. Gifts must be nominal and not tied to enrolling.",
  },
  {
    id: "medicare-disclaimer",
    industries: ["medicare"],
    severity: "warn",
    required: /\bnot connected with or endorsed by\b|\bdo not offer every plan\b/i,
    message: "Medicare agents must print the CMS disclaimer (\"We do not offer every plan available in your area…\") and say you're not connected with the federal Medicare program.",
  },
  // Dental, med spa, optometry, vet
  {
    id: "dental-fee-disclosure",
    industries: ["dental"],
    severity: "warn",
    when: (text) => /\bfree\b|\$\s?\d|\d+\s?%\s*off|\bdiscount/i.test(text),
    required: /\bright to refuse to pay\b/i,
    message: "Dental fee ads have state rules. Florida, for example, requires a printed patient-rights notice in capital letters for free or discounted services and the procedure codes. Check your state board before mailing.",
  },
  {
    id: "dental-specialist",
    industries: ["dental"],
    severity: "warn",
    banned: /\bspecialist\b|\bspecializ\w+ in\b/i,
    message: "Only board-certified specialists can say \"specialist\" or \"specializing in.\" A general dentist should say \"we offer\" instead.",
  },
  {
    id: "med-spa-botox",
    industries: ["med-spa-chiro"],
    severity: "warn",
    banned: /\bbotox\b/i,
    message: "Only use the word \"Botox\" if you buy genuine Botox from Allergan/AbbVie. Otherwise say \"wrinkle-relaxing injections.\" Free or buy-one-get-one units need your medical director's sign-off.",
  },
  {
    id: "optometry-exam-free",
    industries: ["optometry"],
    severity: "warn",
    when: (text) => /\bfree\b[^.]{0,20}\bexam\b|\bexam\b[^.]{0,20}\bfree\b/i.test(text),
    message: "A free or discounted eye exam must list the usual fee, what's included, and that no purchase is required. You also must hand over the prescription.",
  },
  {
    id: "vet-specialist",
    industries: ["vet-pet"],
    severity: "warn",
    banned: /\bspecialist\b|\bbest vet\b|\b#1\b/i,
    message: "Vets can only say \"specialist\" if board certified, and \"best\" or \"#1\" needs proof.",
  },
  // Gyms, retail, salon, laundromat, bakery
  {
    id: "gym-auto-renew",
    industries: ["gyms-fitness"],
    severity: "warn",
    when: (text) => /\b(?:\$\s?\d+\s*(?:\/\s*mo|a month|per month|monthly)|membership|join)\b/i.test(text),
    message: "If memberships auto-renew, say so clearly near the price with how to cancel. California and many states require it, and the FTC enforces it.",
  },
  {
    id: "retail-sweepstakes",
    industries: ["retail-grand-openings", "restaurants-food", "auto-insurance", "churches-community", "bakery", "hair-salon"],
    severity: "warn",
    when: (text) => /\b(?:win|drawing|raffle|sweepstakes|giveaway|enter to)\b/i.test(text) && !/\bno purchase necessary\b/i.test(text),
    message: "A drawing or giveaway by mail must say \"No purchase necessary\" and that buying won't improve the odds. A raffle that requires a purchase can count as an illegal lottery.",
  },
  {
    id: "salon-guarantee",
    industries: ["hair-salon"],
    severity: "warn",
    banned: /\b(?:lasts? forever|permanent results|guaranteed (?:look|results))\b/i,
    message: "Don't promise a look that \"lasts forever.\" Any guarantee needs its conditions printed.",
  },
  {
    id: "laundromat-eco",
    industries: ["laundromat"],
    severity: "warn",
    banned: /\b(?:eco[- ]friendly|green|non-?toxic|chemical[- ]free)\b/i,
    message: "\"Eco-friendly\" or \"green\" claims need proof and a specific reason (for example \"plant-based detergent\").",
  },
  {
    id: "bakery-allergen",
    industries: ["bakery", "restaurants-food"],
    severity: "warn",
    banned: /\b(?:allergen[- ]free|nut[- ]free kitchen|gluten[- ]free)\b/i,
    message: "Only say \"gluten-free\" or \"nut-free\" if you can meet the FDA standard (under 20 ppm gluten, no shared-equipment risk). Otherwise say \"gluten-friendly options.\"",
  },
  // Home services
  {
    id: "roofing-tax-credit",
    industries: ["roofing", "solar", "windows-gutters-siding", "hvac"],
    severity: "block",
    banned: /\b(?:federal |energy |solar )?tax credits?\b|\b(?:30|25)% (?:back|credit)\b/i,
    message: "Don't mention federal tax credits. Most of these home-improvement credits ended in 2025, and a wrong tax claim is deceptive advertising.",
  },
  {
    id: "hvac-r410a",
    industries: ["hvac"],
    severity: "block",
    banned: /\bR-?410A?\b[^.]{0,30}\b(?:banned|illegal|outlawed|phase[d]?[- ]out)\b|\byou must replace\b|\bfederal mandate\b|\bprices? (?:will )?(?:rise|increase) (?:up to )?\d+%/i,
    message: "Don't say R-410A is banned or that the homeowner must replace their system. Repairs are still legal, and EPA's 2026 rule removed the install deadline.",
  },
  {
    id: "garage-door-license",
    industries: ["garage-doors"],
    severity: "warn",
    banned: /\blicensed\b/i,
    message: "Only say \"licensed\" if you hold the contractor license class for garage doors in your state, and print the number.",
  },
  // Kids, churches, precious metals
  {
    id: "tutoring-results",
    industries: ["tutoring-childcare"],
    severity: "warn",
    banned: /\bguaranteed? (?:results|scores?|grades?|improvement)\b|\braise (?:your|their) (?:score|grade)s? by\b|\b\d+[- ]point (?:increase|gain)\b/i,
    message: "Score or grade promises need proof. Say what you teach, not a guaranteed result.",
  },
  {
    id: "church-political",
    industries: ["churches-community"],
    severity: "block",
    banned: /\bvote (?:for|against)\b|\belect\b|\bcandidate\b/i,
    message: "Churches and nonprofits can't support or oppose a political candidate on their mailers.",
  },
  {
    id: "precious-metals-guarantee",
    industries: ["precious-metals"],
    severity: "block",
    banned: /\bguaranteed (?:profit|returns?|growth)\b|\brisk[- ]free\b|\bcan'?t lose\b|\bIRS[- ]approved\b/i,
    message: "Don't promise profits, \"risk-free\" investing, or \"IRS-approved\" metals. Investment claims must be truthful and state the risks.",
  },
]

function appliesTo(flag: ComplianceFlag, industry?: string | null): boolean {
  if (flag.industries === "*") return true
  return Boolean(industry && flag.industries.includes(industry))
}

/** Every compliance flag the printed text trips for this trade. Plain-language messages. */
export function complianceWarnings(text: string, ctx: ComplianceContext = {}): ComplianceWarning[] {
  const out: ComplianceWarning[] = []
  const body = text ?? ""
  for (const flag of COMPLIANCE_FLAGS) {
    if (!appliesTo(flag, ctx.industry)) continue
    if (flag.when && !flag.when(body, ctx)) continue
    if (flag.banned) {
      const hit = body.match(flag.banned)
      if (!hit) continue
      out.push({ id: flag.id, severity: flag.severity, message: flag.message, match: hit[0] })
      continue
    }
    if (flag.required) {
      if (flag.required.test(body)) continue
      out.push({ id: flag.id, severity: flag.severity, message: flag.message })
      continue
    }
    out.push({ id: flag.id, severity: flag.severity, message: flag.message })
  }
  return out
}

/** Banned patterns only, for the copy writer to avoid. */
export function bannedPatternsFor(industry?: string | null): ComplianceFlag[] {
  return COMPLIANCE_FLAGS.filter((f) => f.banned && f.severity === "block" && appliesTo(f, industry))
}

/**
 * Remove blocked claims from one printed line: drops the sentence that carries the claim.
 * Returns "" when nothing is left.
 */
export function stripBlockedClaims(line: string, industry?: string | null): string {
  if (!line) return line
  const flags = bannedPatternsFor(industry)
  if (!flags.length) return line
  const parts = line.split(/(?<=[.!?])\s+/)
  const kept = parts.filter((part) => !flags.some((f) => f.banned!.test(part)))
  return kept.join(" ").trim()
}

/** True when a line trips a blocking flag for this trade. */
export function hasBlockedClaim(line: string, industry?: string | null): boolean {
  return bannedPatternsFor(industry).some((f) => f.banned!.test(line ?? ""))
}

/** Apply `stripBlockedClaims` to every printed string field of a spec. Headline is kept if stripping empties it (callers replace it). */
export function compliantSpecForIndustry<T extends Record<string, unknown>>(spec: T, industry?: string | null): T {
  const next: Record<string, unknown> = { ...spec }
  for (const [key, value] of Object.entries(spec)) {
    if (SKIP.has(key)) continue
    if (typeof value === "string") {
      const stripped = stripBlockedClaims(value, industry)
      next[key] = stripped || (key === "headline" ? value : "")
    } else if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
      next[key] = (value as string[]).map((v) => stripBlockedClaims(v, industry)).filter(Boolean)
    }
  }
  return next as T
}
