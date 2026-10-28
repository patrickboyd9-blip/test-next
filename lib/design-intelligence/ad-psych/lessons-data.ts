/**
 * Client-safe lessons distilled from the Ad Psychologist libraries.
 * Generated from the markdown in this folder. No result figures, no slogans.
 * Campaigns are reasoning examples. Do not import node:fs from this file.
 */

export type DirectionRole = "outcome" | "threat" | "trust"

export interface RoleLesson {
  vertical: string
  role: DirectionRole
  text: string
}

export const ROLE_LESSONS: readonly RoleLesson[] = [
  {
    "vertical": "roofing",
    "role": "outcome",
    "text": "show the finished house on the street, not the shingle."
  },
  {
    "vertical": "roofing",
    "role": "threat",
    "text": "if a card uses fear, pair it with a specific, easy, one-time action (call, scan, book a free inspection)."
  },
  {
    "vertical": "roofing",
    "role": "trust",
    "text": "use one consistent brand asset (color, mascot, face) on every drop so card is recognized at a glance."
  },
  {
    "vertical": "windows",
    "role": "outcome",
    "text": "dramatize ONE felt benefit (quiet, warmth, lower bills) in one image with a twist."
  },
  {
    "vertical": "windows",
    "role": "threat",
    "text": "if a card uses fear, pair it with a specific, easy, one-time action (call, scan, book a free inspection)."
  },
  {
    "vertical": "windows",
    "role": "trust",
    "text": "Local trust uses the business the client named, never an invented count."
  },
  {
    "vertical": "solar",
    "role": "outcome",
    "text": "show who the service protects, not the tread."
  },
  {
    "vertical": "solar",
    "role": "threat",
    "text": "if a card uses fear, pair it with a specific, easy, one-time action (call, scan, book a free inspection)."
  },
  {
    "vertical": "solar",
    "role": "trust",
    "text": "Local trust uses the business the client named, never an invented count."
  },
  {
    "vertical": "hvac",
    "role": "outcome",
    "text": "show who the service protects, not the tread."
  },
  {
    "vertical": "hvac",
    "role": "threat",
    "text": "if a card uses fear, pair it with a specific, easy, one-time action (call, scan, book a free inspection)."
  },
  {
    "vertical": "hvac",
    "role": "trust",
    "text": "Local trust uses the business the client named, never an invented count."
  },
  {
    "vertical": "plumbing",
    "role": "outcome",
    "text": "show who the service protects, not the tread."
  },
  {
    "vertical": "plumbing",
    "role": "threat",
    "text": "if a card uses fear, pair it with a specific, easy, one-time action (call, scan, book a free inspection)."
  },
  {
    "vertical": "plumbing",
    "role": "trust",
    "text": "Local trust uses the business the client named, never an invented count."
  },
  {
    "vertical": "pest",
    "role": "outcome",
    "text": "a five-word outcome headline."
  },
  {
    "vertical": "pest",
    "role": "threat",
    "text": "when fear is real news, give the one-step action."
  },
  {
    "vertical": "pest",
    "role": "trust",
    "text": "Local trust uses the business the client named, never an invented count."
  },
  {
    "vertical": "medicare",
    "role": "outcome",
    "text": "show who the service protects, not the tread."
  },
  {
    "vertical": "medicare",
    "role": "threat",
    "text": "if a card uses fear, pair it with a specific, easy, one-time action (call, scan, book a free inspection)."
  },
  {
    "vertical": "medicare",
    "role": "trust",
    "text": "a local doctor or clinic partner beats a celebrity on trust, and it's easier to keep compliant."
  },
  {
    "vertical": "real_estate",
    "role": "outcome",
    "text": "sell the life in the house, not the square footage."
  },
  {
    "vertical": "real_estate",
    "role": "threat",
    "text": "if a card uses fear, pair it with a specific, easy, one-time action (call, scan, book a free inspection)."
  },
  {
    "vertical": "real_estate",
    "role": "trust",
    "text": "Local trust uses the business the client named, never an invented count."
  },
  {
    "vertical": "food",
    "role": "outcome",
    "text": "sell who the customer becomes, the outcome, not the product."
  },
  {
    "vertical": "food",
    "role": "threat",
    "text": "if a card uses fear, pair it with a specific, easy, one-time action (call, scan, book a free inspection)."
  },
  {
    "vertical": "food",
    "role": "trust",
    "text": "Local trust uses the business the client named, never an invented count."
  },
  {
    "vertical": "dental",
    "role": "outcome",
    "text": "the confident smile, not the aligner."
  },
  {
    "vertical": "dental",
    "role": "threat",
    "text": "if a card uses fear, pair it with a specific, easy, one-time action (call, scan, book a free inspection)."
  },
  {
    "vertical": "dental",
    "role": "trust",
    "text": "Local trust uses the business the client named, never an invented count."
  },
  {
    "vertical": "landscaping",
    "role": "outcome",
    "text": "show the evening on the deck, not the boards."
  },
  {
    "vertical": "landscaping",
    "role": "threat",
    "text": "if a card uses fear, pair it with a specific, easy, one-time action (call, scan, book a free inspection)."
  },
  {
    "vertical": "landscaping",
    "role": "trust",
    "text": "Local trust uses the business the client named, never an invented count."
  },
  {
    "vertical": "legal",
    "role": "outcome",
    "text": "show who the service protects, not the tread."
  },
  {
    "vertical": "legal",
    "role": "threat",
    "text": "if a card uses fear, pair it with a specific, easy, one-time action (call, scan, book a free inspection)."
  },
  {
    "vertical": "legal",
    "role": "trust",
    "text": "Local trust uses the business the client named, never an invented count."
  },
  {
    "vertical": "general",
    "role": "outcome",
    "text": "show who the service protects, not the tread."
  },
  {
    "vertical": "general",
    "role": "threat",
    "text": "if a card uses fear, pair it with a specific, easy, one-time action (call, scan, book a free inspection)."
  },
  {
    "vertical": "general",
    "role": "trust",
    "text": "Local trust uses the business the client named, never an invented count."
  }
]

export const FORBIDDEN_CAMPAIGN_LINES: readonly string[] = [
  "$1,200/yr medicare mistake",
  "$1,200/yr mistake",
  "$9,850 average insurance-covered replacement",
  "$x saved without trying",
  "(no source verified),",
  "15 minutes could save you 15% or more",
  "2 of 10 already stamped",
  "30-yr architectural shingles",
  "9 out of 10 people in your area pay on time",
  "a diamond is forever",
  "a different kind of company,",
  "a dui can cost your license. here's what to do in the next 10 days",
  "ads worth spreading",
  "advertising material",
  "air duct cleaning",
  "anyone can do it",
  "approved to participate in medicare",
  "as-is cash purchase",
  "as-is, ugly is fine",
  "average savings $x",
  "away go troubles down the drain",
  "back for 2 weeks only",
  "because i'm worth it",
  "because so much is riding on your tires",
  "best deals ever!!!",
  "better call saul",
  "bfd (bigger faster design)",
  "buzzed driving is drunk driving",
  "campaign for real beauty,",
  "can you hear me now?",
  "carl and stu skills challenge",
  "cash offer within 24 hours",
  "character; chamberlain myq",
  "chimney safety week",
  "claims expire 12 months",
  "color of the year",
  "come see our classroom",
  "commit to something",
  "contracted with medicare",
  "demand better solar",
  "diving into data",
  "does she… or doesn't she?",
  "don't buy this jacket",
  "don't leave storm damage unchecked.",
  "don't let an unused coupon expire",
  "don't mess with texas",
  "every kiss begins with kay",
  "every roof gets a free 21-point inspection,",
  "faces looking toward cta",
  "faces of sensitivity",
  "family-owned in [town]",
  "federally insured by ncua",
  "feed your lawn. feed it!",
  "feel like yourself again",
  "feel the power of done",
  "find your way home",
  "for a $0 premium or reduced premium, deductibles, or cost-sharing.",
  "free credit scores",
  "free, free, free…",
  "go below with rowe",
  "go red for women,",
  "guarantee anyone a 0–3.5% down home loan",
  "guaranteed acceptance",
  "gutter nightmares",
  "halftime showing",
  "heating season starts: inspect first",
  "help, i've fallen…",
  "here's what we fixed",
  "hidden-structure home safety",
  "i'd like to make an offer on [address]",
  "i've fallen and i can't get up!",
  "if you needed a transplant would you have one? if so please help others",
  "invis is drama free",
  "is your roof 15+ years old? □yes",
  "it's fix a leak week",
  "it's hard to stop a trane",
  "jake from state farm",
  "join and get 10 free trees",
  "judgement free zone",
  "keep the people you love warm and dry this winter,",
  "kills bugs dead,",
  "labels against women",
  "like brands. only cheaper.",
  "lock in this price before [date]",
  "look, mom—no cavities!",
  "mealtimes made easy",
  "medicare coverage helpline",
  "missing benefits",
  "mosquitoes and zika",
  "most people like you already did this",
  "must be truly free (ftc guide on",
  "must be truly free, with conditions disclosed nearby (ftc guide on",
  "neighborhood pride",
  "no contracts. we pay your cancellation fee.",
  "no published results.",
  "no verified results found",
  "nothing runs like a deere",
  "nothing runs like a deere.",
  "odd numbers are more credible",
  "odd numbers more credible",
  "offer ends sunday [real date]. don't miss $5 off.",
  "only 3 coupons left in your area!",
  "pass it on to a neighbor",
  "pennies on the dollar",
  "performance-engineered",
  "performance-engineered for your life outdoors",
  "pizza turnaround",
  "pizza turnaround,",
  "proud [town] homeowners keep their [yards/roofs] sharp.",
  "push button, get mortgage",
  "ran out of dinner ideas? tacos for 4, $5 off—tonight,",
  "real beauty sketches",
  "real estate in real time",
  "red = urgency lifts response",
  "scan to pick your shingle color / build your plan",
  "seize the awkward",
  "sell as-is, on your timeline, and start your next chapter,",
  "should've gone to specsavers,",
  "silly stuff is good,",
  "simple steps save lives,",
  "stay off your ladders",
  "steal a base, steal a taco",
  "step 1 done, call to finish.",
  "stop selling features… sell the experience.",
  "storm damage claims expire 12 months after the event.",
  "take back the bath",
  "take your time back",
  "tastes great! less filling!",
  "the best job in the world,",
  "the gift that gives back",
  "the house where the kids grew up",
  "the housing market",
  "the life improvement store.",
  "the most interesting man in the world,",
  "the punctual plumber",
  "the smart move on your street",
  "this is your brain on drugs",
  "this isn't just a man's disease",
  "this year's color",
  "tips from former smokers,",
  "turn to the experts",
  "two months' salary",
  "two neighbors on your street…",
  "variable data printing lifts response markedly",
  "vdp lifts markedly",
  "vinnie jones / stayin' alive,",
  "virtual ownership",
  "wbh needs 5–7+ touches",
  "we answer our own phone",
  "we buy ugly houses",
  "we do not offer every plan available in your area…",
  "we heard you. here's what we fixed.",
  "we'll leave the light on for you",
  "what could go wrong",
  "what goes wrong if you don't",
  "what happens here, stays here",
  "what homes on your street sold for → see back",
  "what your home could look like",
  "what's an aflac?",
  "what's for dinner.",
  "when banks compete, you win",
  "where life happens",
  "where's the beef?",
  "window covering safety month,",
  "windows for people",
  "with a hard end trains customers to buy in advance (",
  "you may be missing out on benefits",
  "you vs. big insurance.",
  "you vs. efficient neighbors",
  "you're crazy, it has no feelings",
  "you're the smart one",
  "your $x credit is reserved for [address]",
  "your bank has scheduled your foreclosure,",
  "your house with this door",
  "your neighbors already did x,",
  "your neighbors on [street] chose us",
  "your roof could produce ~x",
  "your roof will collapse tonight.",
  "your roof, your number",
  "your weekend back",
  "| threat with no action, or invented damage claims (",
  "☑ yes, reserve my spot"
]

const RESULT = /\b(?:impressions?|views?|lift|roi|award|unverified|percentage points?|brand awareness|effie)\b/i
const RESULT_FIGURE = /\b\d[\d,.]*(?:\s*(?:%|k|m|x))\b/i

export function lessonFor(kind: string, role: DirectionRole): string {
  return ROLE_LESSONS.find((lesson) => lesson.vertical === kind && lesson.role === role)?.text
    ?? ROLE_LESSONS.find((lesson) => lesson.vertical === "general" && lesson.role === role)?.text
    ?? "Show the result the customer gets, not the product feature."
}

export function textHasAgencyResult(text: string): boolean {
  return RESULT.test(text) && RESULT_FIGURE.test(text)
}

export function headlineCopiesCampaign(headline: string): boolean {
  const line = headline.replace(/\s+/g, " ").trim().toLowerCase().replace(/[.!?]+$/g, "")
  if (line.length < 12) return false
  return FORBIDDEN_CAMPAIGN_LINES.some((item) => item.replace(/[.!?]+$/g, "") === line)
}
