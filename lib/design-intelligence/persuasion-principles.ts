/**
 * Persuasion principles for the copywriter, the art director, and the critic.
 * Source: Patrick's Ad Psychologist notes.
 * These are rules to apply. They are not lines to print and not a layout to trace.
 */

export const EVIDENCE_STRENGTHS = ["strong", "mixed", "weak-mixed", "hypothesis", "mixed-test"] as const
export type EvidenceStrength = (typeof EVIDENCE_STRENGTHS)[number]

export const PERSUASION_VERTICALS = [
  "roofing",
  "plumbing",
  "hvac",
  "medicare",
  "we_buy",
  "real_estate",
  "food",
  "retail",
  "dental",
  "pest",
  "landscaping",
  "solar",
  "general",
] as const
export type PersuasionVertical = (typeof PERSUASION_VERTICALS)[number]

export const PERSUASION_TONES = [
  "urgent",
  "calm",
  "professional",
  "friendly",
  "playful",
  "empathetic",
  "appetite",
] as const
export type PersuasionTone = (typeof PERSUASION_TONES)[number]

export interface PersuasionPrinciple {
  id: string
  name: string
  /** Short label for the studio line, e.g. "sell the outcome". */
  label: string
  rule: string
  postcard: string
  verticals: readonly PersuasionVertical[]
  tones: readonly PersuasionTone[]
  evidence: EvidenceStrength
  ethics: string
}

const ALL_VERTICALS = PERSUASION_VERTICALS
const LOCAL_TONES = PERSUASION_TONES

export const PERSUASION_PRINCIPLES: readonly PersuasionPrinciple[] = [
  {
    id: "attention_capture",
    name: "Attention capture",
    label: "one dominant image",
    rule: "One dominant image, a big headline, and minimal clutter.",
    postcard: "One photograph and one headline carry the front. Everything else stays quiet.",
    verticals: ALL_VERTICALS,
    tones: LOCAL_TONES,
    evidence: "strong",
    ethics: "Do not buy attention with a fake official notice or a wall of badges.",
  },
  {
    id: "reciprocity",
    name: "Reciprocity",
    label: "give first",
    rule: "Give something first: a free inspection, a valuation, or a free item.",
    postcard: "The offer is a real gift the reader can use, stated once, before the ask.",
    verticals: ["roofing", "plumbing", "hvac", "we_buy", "real_estate", "food", "retail", "dental", "pest", "solar", "landscaping", "general"],
    tones: ["friendly", "professional", "calm", "empathetic", "playful", "appetite"],
    evidence: "mixed",
    ethics: "Medicare does not call a $0 premium free. The gift has to be something the business will actually give.",
  },
  {
    id: "social_proof",
    name: "Social proof",
    label: "real local proof",
    rule: "Use local neighbor norms, and only counts the client supplied.",
    postcard: "A neighbor line is allowed only when the count is in the brief.",
    verticals: ALL_VERTICALS,
    tones: ["friendly", "professional", "calm", "empathetic"],
    evidence: "mixed",
    ethics: "Never invent a count, a star rating, or a neighborhood statistic.",
  },
  {
    id: "authority",
    name: "Authority",
    label: "true credentials",
    rule: "Licenses, certifications, and years count only when they are true.",
    postcard: "One credential line, smaller than the phone, and only if the brief states it.",
    verticals: ["roofing", "plumbing", "hvac", "medicare", "dental", "pest", "solar", "general"],
    tones: ["professional", "calm", "empathetic"],
    evidence: "mixed",
    ethics: "Do not invent a license, a certification, or a years-in-business figure.",
  },
  {
    id: "scarcity",
    name: "Scarcity",
    label: "genuine scarcity",
    rule: "Scarcity only when the limit is genuine.",
    postcard: "A limit is printed only when the client named the remaining quantity.",
    verticals: ["food", "retail", "dental", "hvac"],
    tones: ["urgent", "playful"],
    evidence: "weak-mixed",
    ethics: "No fake limits, no 'only a few left,' and no countdown the business did not set.",
  },
  {
    id: "loss_framing",
    name: "Loss framing",
    label: "loss versus gain",
    rule: "Test loss framing against gain framing. Never use it for something the reader does not already have.",
    postcard: "Loss language is for coverage or a benefit the reader can actually lose. A free inspection is a gain.",
    verticals: ["medicare", "roofing", "real_estate"],
    tones: ["urgent", "calm", "professional"],
    evidence: "mixed",
    ethics: "Do not tell someone they can lose a free visit, a gift, or a discount they never had.",
  },
  {
    id: "commitment",
    name: "Commitment",
    label: "a small yes",
    rule: "Ask for a small self-identifying yes, such as 'Roof 15+ years old?'",
    postcard: "One question the reader can answer about their own house, then one next step.",
    verticals: ["roofing", "plumbing", "hvac", "dental", "pest", "solar", "landscaping"],
    tones: ["friendly", "professional", "calm"],
    evidence: "mixed",
    ethics: "The question has to be something the reader can know. Do not imply you already know their health, income, or distress.",
  },
  {
    id: "liking",
    name: "Liking",
    label: "a local face",
    rule: "A local owner's face, or a family-owned line, makes the sender a person.",
    postcard: "One real person from the business, or the words family-owned, when that is true.",
    verticals: ALL_VERTICALS,
    tones: ["friendly", "empathetic", "calm", "playful"],
    evidence: "mixed",
    ethics: "Do not use a stock family or claim family-owned unless the brief says so.",
  },
  {
    id: "curiosity_gap",
    name: "Curiosity gap",
    label: "open, then resolve",
    rule: "Open a question on the front and resolve it on the back.",
    postcard: "The front asks one question. The back answers it. The front does not withhold the offer.",
    verticals: ALL_VERTICALS,
    tones: ["playful", "friendly", "professional", "appetite"],
    evidence: "mixed",
    ethics: "Do not hide the price, the sender, or a required Medicare disclaimer.",
  },
  {
    id: "urgency",
    name: "Urgency",
    label: "real deadline",
    rule: "A concrete real date beats 'act now.' Test it.",
    postcard: "Print a date only when the client named that date. Otherwise leave the deadline off.",
    verticals: ALL_VERTICALS,
    tones: ["urgent", "professional"],
    evidence: "mixed-test",
    ethics: "No 'act now,' no invented expiry, and no deadline the business will not honor.",
  },
  {
    id: "endowed_progress",
    name: "Endowed progress",
    label: "a head start",
    rule: "Show that step 1 is already done, or that the card is pre-stamped.",
    postcard: "One line that a first step is finished, only when the business has actually done it.",
    verticals: ["medicare", "roofing", "solar", "real_estate", "we_buy", "general"],
    tones: ["calm", "professional", "empathetic"],
    evidence: "mixed",
    ethics: "Do not pretend a form was filed or a credit was applied if it was not.",
  },
  {
    id: "choice_architecture",
    name: "Choice architecture",
    label: "three choices at most",
    rule: "Offer at most three tiers.",
    postcard: "One price on the front. If tiers exist, stop at three, and put the rest on the back.",
    verticals: ["hvac", "medicare", "solar", "dental", "pest", "retail"],
    tones: ["calm", "professional"],
    evidence: "mixed",
    ethics: "Do not hide a required plan difference, and do not invent a third tier.",
  },
  {
    id: "contrast",
    name: "Contrast",
    label: "one high-contrast action",
    rule: "A high-contrast call to action, and large type for seniors.",
    postcard: "The phone or the offer is the high-contrast element. Medicare type stays large and calm.",
    verticals: ["medicare", "roofing", "plumbing", "hvac", "dental", "general"],
    tones: ["calm", "professional", "urgent"],
    evidence: "hypothesis",
    ethics: "Contrast is not a flashing badge or a government-notice palette.",
  },
  {
    id: "isolation_effect",
    name: "Isolation effect",
    label: "one standout offer",
    rule: "Exactly one visually distinct element, usually the offer.",
    postcard: "One offer treatment. No second badge, burst, or coupon box.",
    verticals: ALL_VERTICALS,
    tones: LOCAL_TONES,
    evidence: "strong",
    ethics: "Never mimic FINAL NOTICE or government styling to make that element stand out.",
  },
  {
    id: "specificity",
    name: "Specificity",
    label: "specific claims",
    rule: "Specific verifiable claims. Retail prices may use a 99 ending.",
    postcard: "A price or a fact from the brief, stated exactly. A 99 ending only when that is the real price.",
    verticals: ["retail", "food", "plumbing", "hvac", "dental", "pest", "landscaping"],
    tones: ["professional", "playful", "appetite", "friendly"],
    evidence: "mixed",
    ethics: "Do not invent a precise number to sound credible.",
  },
  {
    id: "foot_in_the_door",
    name: "Foot in the door",
    label: "a tiny first step",
    rule: "Ask for a tiny first step, such as scanning a code for a storm map.",
    postcard: "The code does one small job. The phone remains the main response.",
    verticals: ["roofing", "solar", "real_estate", "we_buy", "pest", "general"],
    tones: ["friendly", "professional", "calm"],
    evidence: "mixed",
    ethics: "The scan has to lead somewhere real. Do not disguise a hard sell as a map.",
  },
  {
    id: "endowment",
    name: "Endowment",
    label: "already theirs",
    rule: "Say the credit is reserved for this address when that reservation is real.",
    postcard: "An address line only from the mailing list, and only when a credit was actually reserved.",
    verticals: ["we_buy", "retail", "solar", "roofing"],
    tones: ["empathetic", "professional", "calm"],
    evidence: "mixed",
    ethics: "Do not imply a personal credit, a hardship, or knowledge of this household's finances.",
  },
  {
    id: "personalization",
    name: "Personalization",
    label: "their neighborhood",
    rule: "Personalize by geography. Never imply knowledge of distress, health, or income.",
    postcard: "A neighborhood, city, or street the mail drop actually covers. Nothing about this person's private life.",
    verticals: ALL_VERTICALS,
    tones: ["friendly", "empathetic", "calm", "professional"],
    evidence: "mixed",
    ethics: "Geography only. No health, income, foreclosure, or other private-status implication.",
  },
  {
    id: "sequence_consistency",
    name: "Sequence consistency",
    label: "one brand, three cards",
    rule: "Keep the brand consistent across a sequence of three or more cards.",
    postcard: "The same name, colors, and offer story on every card in the sequence.",
    verticals: ALL_VERTICALS,
    tones: LOCAL_TONES,
    evidence: "mixed",
    ethics: "Consistency is not a reason to repeat a false claim.",
  },
  {
    id: "emotion_by_vertical",
    name: "Emotion by vertical",
    label: "the feeling of the trade",
    rule: "Match the feeling to the trade, without scare tactics.",
    postcard: "Roofing protects the home. We-buy offers relief, speed, and certainty. Medicare offers security and clarity. Food offers appetite and the pride of a smart buy.",
    verticals: ["roofing", "we_buy", "medicare", "food", "retail"],
    tones: LOCAL_TONES,
    evidence: "mixed",
    ethics: "Roofing does not scare. We-buy stays empathetic. Medicare uses no fear. Food does not shame.",
  },
  {
    id: "sell_the_outcome",
    name: "Sell the outcome",
    label: "sell the outcome",
    rule: "Sell the outcome, not the feature.",
    postcard: "Roofing is a safe dry home and peace of mind. We-buy is a fresh start. Medicare is confidence. Food is the moment and the memory.",
    verticals: ALL_VERTICALS,
    tones: LOCAL_TONES,
    evidence: "mixed",
    ethics: "The outcome has to be one the business can actually deliver. Do not promise a result the offer does not support.",
  },
]

const BY_ID = new Map(PERSUASION_PRINCIPLES.map((principle) => [principle.id, principle]))

export function persuasionPrinciple(id: string): PersuasionPrinciple | undefined {
  return BY_ID.get(id)
}
