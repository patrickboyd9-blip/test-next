import {
  assertReferenceCard,
  type ReferenceCard,
  type ReferenceCardPackGroup,
} from "./reference-card"

/**
 * Curated Research Taste Pack.
 *
 * About twenty postcard readings from patrickboyd9-blip/modern-mail-research.
 * Text only. No logos, no specimen art, no source URLs, no vendor case-study math.
 * INTERNAL RESEARCH / REFERENCE ONLY — imitate the craft, not the brand.
 *
 * Mix (founder-approved):
 * - 10 home services, covering HVAC, plumbing, electrical, roofing, pest,
 *   and landscaping. Two adjacent exterior/structural postcards are included
 *   because the next records in the named trades published results without
 *   observed composition.
 * - 4 local healthcare: dental, med spa, chiropractic, physical therapy.
 * - 3 hospitality: restaurant, pizza, foot-traffic.
 * - 3 craft exemplars: premium versus template, hierarchy, small-card restraint.
 */
export const RESEARCH_TASTE_PACK: readonly ReferenceCard[] = [
  {
    mmrId: "MMR-001",
    vertical: "roofing",
    format: "postcard",
    dimensions: null,
    packGroup: "home_services",
    confidence: "high",
    principles: [
      "Show the indoor consequence of the problem, such as water where it should not be, not only a finished roof.",
      "One urgent headline is the interrupt. Do not stack a second headline of equal weight.",
      "Pair that interrupt with one low-friction response path already on the brief.",
      "A tangible extra on top of a free look can be the clincher only when the brief already includes that extra. Do not invent one.",
    ],
    compositionNotes:
      "One consequence photograph and one bold headline carry the face. The response mark sits with that headline, not in a row of equal badges. Trim size was not observed.",
    imageryNotes:
      "The observed image was an interior leak, not a crew portrait and not a sunny finished roof. Use an illustrative category situation when the brief does not document this recipient's damage. Stop before gore or a disaster spectacle.",
    ctaNotes:
      "A scan or a call for an urgent quote. One action. If both a phone and a QR are on the brief, they serve that same action.",
    whyItWorks:
      "The cost of waiting is visible in one glance, and there is a single way to act.",
  },
  {
    mmrId: "MMR-002",
    vertical: "hvac",
    format: "postcard",
    dimensions: "6 x 8.5 in",
    packGroup: "home_services",
    confidence: "high",
    principles: [
      "A larger card can hold more than one legitimate offer, but one offer must still lead. Equal tiles dilute the interrupt.",
      "Put one real review already on the brief on the address side, next to the benefit. Do not build a badge farm on the front.",
      "A QR is a path to the site or the booking link on the brief, not a decoration.",
      "Do not invent rebates, tune-up menus, or prices the brief does not list.",
    ],
    compositionNotes:
      "Front carries the lead offer. The reverse holds a short benefit list and one review. The source did not publish the headline, so do not invent a slogan to fill the gap.",
    imageryNotes:
      "The photograph was not fully described. Do not fake a specific crew or a specific house. A quiet illustrative service situation is enough when the offer is the interrupt.",
    ctaNotes: "QR to the website or booking path on the brief. One path.",
    whyItWorks:
      "The extra space is used for a menu with a clear lead, and trust sits on the back where the reader looks after the offer.",
  },
  {
    mmrId: "MMR-019",
    vertical: "plumbing",
    format: "postcard",
    dimensions: "6 x 8.5 in",
    packGroup: "home_services",
    confidence: "high",
    principles: [
      "An emergency trade can be designed to be kept until it is needed. Use a non-expiring offer only when the brief's offer is actually evergreen.",
      "The address side carries a short trust line and one review, not a second campaign.",
      "Phone is the natural primary action for an emergency when the brief has a phone.",
      "A small first-visit offer can be the icebreaker. Do not enlarge it into a discount the brief does not state.",
    ],
    compositionNotes:
      "Oversized card meant to stay in the house. Trust line and review on the back. The front headline was not published.",
    imageryNotes:
      "The observed visual system was cohesive and calm. Do not paste a stock emblem or a novelty pattern. No specimen art ships with this card.",
    ctaNotes:
      "Phone-first for an emergency. Any other path on the brief serves that same action.",
    whyItWorks:
      "The piece is built to survive in a drawer until something breaks, so the trust line has to stay readable later.",
  },
  {
    mmrId: "MMR-051",
    vertical: "electrical",
    format: "postcard",
    dimensions: "6 x 8.5 in",
    packGroup: "home_services",
    confidence: "high",
    principles: [
      "Large type for a reader who will not study the card. One limited offer, not a catalog.",
      "A recognizable picture of someone doing the work is for category recognition, not proof that this is the customer's crew.",
      "Contact and the action must be readable at arm's length.",
      "If the brief is a household, do not import a commercial-facility story the brief does not have.",
    ],
    compositionNotes:
      "Jumbo card, large offer type, a worker image, and contact kept easy to scan. The exact offer wording was not published.",
    imageryNotes:
      "An electrical worker was the observed image. Treat it as an illustrative work situation unless the brief documents this company's people.",
    ctaNotes: "Call or inquire. One action.",
    whyItWorks:
      "A busy reader gets the category, the offer, and how to respond without decoding a layout.",
  },
  {
    mmrId: "MMR-009",
    vertical: "pest",
    format: "postcard",
    dimensions: null,
    packGroup: "home_services",
    confidence: "high",
    principles: [
      "Frame protection of the home when the audience is upscale. Do not default to a loud percent-off.",
      "Show a concrete threat, not a generic icon set.",
      "A private or soft consult fits a plan offer. Use it only when the brief's offer is a consult or a plan.",
      "Threat imagery has a limit. Gross-out is not the same as clarity.",
    ],
    compositionNotes:
      "A threat image, a protection headline, and one QR. Dimensions were not observed.",
    imageryNotes:
      "Specific pests were shown, contained in the picture. Do not fill the card with a collage or with gore.",
    ctaNotes: "QR for a private offer or consult. One path.",
    whyItWorks:
      "The card sells care of the property, and the picture makes the risk specific without becoming a horror poster.",
  },
  {
    mmrId: "MMR-018",
    vertical: "landscaping",
    format: "postcard",
    dimensions: null,
    packGroup: "home_services",
    confidence: "high",
    principles: [
      "A generic beautiful yard is weaker than a picture of the kind of property this recipient actually has.",
      "Do not invent a photo of this recipient's lot. Address-level imagery is honest only when the brief supports it.",
      "The picture of the change can be the interrupt, with the appointment as the action, when the brief is about seeing a change rather than clipping a coupon.",
      "A person still has to approve any generated after-picture before it is treated as a promise.",
    ],
    compositionNotes:
      "The observed card was a before-and-after of one property. Headline and small type were not published, so do not invent a slogan. If the brief cannot support a specific property, lead with type or an illustrative situation instead of faking an address-level photo.",
    imageryNotes:
      "A reimagined yard was the idea. It is not a stock sunset lawn, and it is not evidence of a finished job at that address unless the brief says so.",
    ctaNotes: "An appointment or an estimate. The exact words were not observed.",
    whyItWorks:
      "It closes the gap between the yard someone has and a decision, when the picture is honest.",
  },
  {
    mmrId: "MMR-327",
    vertical: "landscaping",
    format: "postcard",
    dimensions: "6.5 x 9 in",
    packGroup: "home_services",
    confidence: "high",
    principles: [
      "An oversized local card can carry owner-operated trust and a guarantee next to one promotional offer.",
      "The guarantee and the offer should not compete. One leads.",
      "Local ownership is a trust line only when the brief says the business is local or owner-operated.",
      "Do not invent a guarantee.",
    ],
    compositionNotes:
      "Oversized postcard. The observed elements were a promotional offer, local-ownership language, and a results guarantee. The exact layout and the offer amount were not published, so do not invent a price or a grid of boxes.",
    imageryNotes:
      "Photography was not described. Do not fill the extra space with stock lawn beauty. Leave room for the trust line and the offer.",
    ctaNotes: "A call or a booking path. The exact words were not observed.",
    whyItWorks:
      "The size signals a real local presence, and the guarantee answers the risk of hiring a new crew, when those facts are true.",
  },
  {
    mmrId: "MMR-104",
    vertical: "exterior_cleaning",
    format: "postcard",
    dimensions: "6.25 x 8.5 in",
    packGroup: "home_services",
    confidence: "high",
    principles: [
      "The front has a headline and the service, enough to flip the card. The back holds the offer and the proof.",
      "A before-and-after is the image job for exterior cleaning when it stays illustrative, not a claim about this recipient's house.",
      "A free small add-on can lead into a larger package only if the brief includes that free add-on.",
      "One proof near the offer is enough. A second review is not a reason to start a badge row.",
    ],
    compositionNotes:
      "Front: the service and a headline. Back: the offer, photos, and reviews. A before-and-after was part of the observed design.",
    imageryNotes:
      "Before-and-after of exterior cleaning. Do not present it as this homeowner's documented house.",
    ctaNotes: "Call or book. The exact string was not published.",
    whyItWorks:
      "The reader sees the change and the offer without the front becoming a coupon sheet.",
  },
  {
    mmrId: "MMR-050",
    vertical: "foundation",
    format: "postcard",
    dimensions: "6 x 8.5 in",
    packGroup: "home_services",
    confidence: "high",
    principles: [
      "High-ticket structural work leads with a free in-home evaluation when that offer is on the brief. Do not invent the evaluation.",
      "Photos of completed work carry the trust. A fear poster does not.",
      "The service list belongs on the back, under the evaluation, not as several equal heroes.",
      "Do not add extra offers to make a quiet, high-ticket card feel busier.",
    ],
    compositionNotes:
      "Jumbo card. Work photos, a free evaluation, and a QR on the front. A service list on the back.",
    imageryNotes:
      "Photos of completed repair. Illustrative unless the brief documents this company's jobs. Not a scare montage.",
    ctaNotes: "Book the evaluation, or scan for that same action. One action.",
    whyItWorks:
      "The card asks for a qualified look, and the photos answer whether this kind of work has been done, without shouting.",
  },
  {
    mmrId: "MMR-105",
    vertical: "chimney",
    format: "postcard",
    dimensions: "6 x 8.5 in",
    packGroup: "home_services",
    confidence: "high",
    principles: [
      "A safety trade may show the risk as a clear contrast, such as clogged versus clear, in large type with an easy phone path.",
      "One cautionary interrupt. Do not add a discount stack on top of the warning.",
      "A house on fire as the default picture is the line not to cross. Show the hazard, not a horror still.",
      "How often the card is mailed is a program choice, not a layout.",
    ],
    compositionNotes:
      "Jumbo card, large type, easy contact, and a cautionary clogged-vent message. The source also described fire imagery. Use the hazard contrast. Refuse the spectacle unless the brief explicitly asks for a stronger warning, and even then stay short of gore.",
    imageryNotes:
      "Clogged versus clean was the useful contrast. A burning house was the observed excess, not the pattern to copy.",
    ctaNotes: "Phone. The exact words were not published.",
    whyItWorks:
      "The risk is understandable in one glance, and the phone is the only ask.",
  },
  {
    mmrId: "MMR-285",
    vertical: "dental",
    format: "postcard",
    dimensions: null,
    packGroup: "local_healthcare",
    confidence: "high",
    principles: [
      "A welcome line beats a coupon shout when the reader is new in town, and only if the brief is actually about new residents.",
      "A photograph of the office is for recognition of the place, not a stock smile.",
      "Accepted plans belong on the back as a practical list, and only the plans the brief names. Do not invent insurers.",
      "One obvious next step.",
    ],
    compositionNotes:
      "A welcome headline, photos of the location, and an insurance list on the back. Trim size was not observed.",
    imageryNotes:
      "The practice's own place, not a generic model. If there is no real office photo, do not fake one. Say there is no photograph.",
    ctaNotes: "A visit or a call. One step.",
    whyItWorks:
      "The card answers who you are, where you are, and whether a stated plan is accepted, without looking like a coupon pack.",
  },
  {
    mmrId: "MMR-021",
    vertical: "med_spa",
    format: "postcard",
    dimensions: null,
    packGroup: "local_healthcare",
    confidence: "high",
    principles: [
      "Tone stays gentle. This is not an emergency postcard.",
      "A time-since-last-visit line is honest only when the brief has that fact. Do not invent a lapse.",
      "A private QR to a booking form fits a discreet offer better than a public coupon blast.",
      "One re-entry offer. Do not menu the whole treatment list on the front.",
    ],
    compositionNotes:
      "A beauty-forward postcard, elapsed-time language, and a QR as the primary path. The full layout was not published.",
    imageryNotes:
      "No specimen photo is in this pack. Keep imagery calm. Do not import another brand's beauty photography.",
    ctaNotes: "Scan to a private booking path when the brief has a QR or a URL.",
    whyItWorks:
      "It feels like a reminder from the practice, which is how people return for this kind of care.",
  },
  {
    mmrId: "MMR-041",
    vertical: "chiropractic",
    format: "postcard",
    dimensions: null,
    packGroup: "local_healthcare",
    confidence: "high",
    principles: [
      "One high-contrast field and one large headline can beat a bigger card full of modules.",
      "A free exam leads only when the brief includes it. Do not invent a diagnostic.",
      "Hard urgency is appropriate only when the brief has a real deadline or a closing window. Do not paint every card red and shout.",
      "The phone is the action for the exam when the brief has a phone.",
    ],
    compositionNotes:
      "A bright field, a large light headline, and a subhead toward the phone. Photography and trim were not published.",
    imageryNotes:
      "The color field was the observed interrupt, not a photo of an accident. Do not stage a crash.",
    ctaNotes: "Call for the exam. One action.",
    whyItWorks:
      "The mailbox interrupt is the contrast and the single line, so the offer does not have to fight a layout.",
  },
  {
    mmrId: "MMR-042",
    vertical: "physical_therapy",
    format: "postcard",
    dimensions: null,
    packGroup: "local_healthcare",
    confidence: "medium",
    principles: [
      "Relief can be the picture: the outcome of care, not a wound.",
      "A short numbered path helps an appointment business, using only steps the brief supports.",
      "The consequence of waiting can be the message when the brief is about untreated pain. Do not turn it into an alarmist poster.",
      "Contact must be easy to find. One action.",
    ],
    compositionNotes:
      "Strong color, large relief imagery, two images, a simple stepped action, and contact that is easy to locate. The exact steps and headline were not published, so do not invent a script. Confidence is medium because the source did not publish the steps or a response count.",
    imageryNotes:
      "Relief, not injury gore. Two images were observed. They should not compete with the headline.",
    ctaNotes: "A stepped path to book. The exact steps are unknown.",
    whyItWorks:
      "The reader sees relief and a clear way to start, which is the job of a care postcard.",
  },
  {
    mmrId: "MMR-012",
    vertical: "restaurant",
    format: "postcard",
    dimensions: "6 x 9 in",
    packGroup: "hospitality",
    confidence: "high",
    principles: [
      "One free hero item for a first visit, when that offer is on the brief. Do not invent a free dish.",
      "The card should feel like the food: vivid, specific, and local to the neighborhood in the brief.",
      "A unique code or QR is for redemption, not a second headline.",
      "Separate the locations only when the brief is actually about more than one store.",
    ],
    compositionNotes:
      "A vivid 6 by 9 inch card with a unique QR. The headline was not published.",
    imageryNotes:
      "Food, not a logo lockup and not an empty table. No specimen photo is in this pack.",
    ctaNotes: "Scan to redeem the one offer.",
    whyItWorks:
      "The free item is the reason to walk in, and the code makes that reason specific to the piece in hand.",
  },
  {
    mmrId: "MMR-170",
    vertical: "pizza_qsr",
    format: "postcard",
    dimensions: null,
    packGroup: "hospitality",
    confidence: "high",
    principles: [
      "An oversized card and a physical interaction, such as a scratch-off, can be the interrupt for pizza when the piece is meant to be handled.",
      "Do not invent a scratch-off, a game, or a stack of deals the brief does not include.",
      "Mailing every week is a schedule, not a layout.",
      "One offer still leads. Interaction is not an excuse for a coupon collage.",
    ],
    compositionNotes:
      "An extra-large card plus a scratch-off. The exact inch size and the deal copy were not published. Do not draw a fake scratch panel unless the brief asks for one.",
    imageryNotes:
      "The format itself was the visual impact. Food photography was not described. Do not fill the card with generic pizza photography as if that were the idea.",
    ctaNotes:
      "The interaction reveals the offer. The exact action line was sparse in the source, so use the path on the brief.",
    whyItWorks:
      "The card asks to be touched, which is a real interrupt in a pile of flat coupons, when the format is honest.",
  },
  {
    mmrId: "MMR-178",
    vertical: "restaurant",
    format: "postcard",
    dimensions: "6 x 12 in",
    packGroup: "hospitality",
    confidence: "high",
    principles: [
      "Jumbo food photography can be the ground, with one strong headline and one way to order.",
      "Several codes are a way to tell neighborhoods apart. They are not a reason to design several equal offers. One offer leads unless the brief truly has distinct offers.",
      "A plain order line is enough when the path is a QR or a phone already on the brief.",
      "New-item framing only when the brief has a new item.",
    ],
    compositionNotes:
      "A 6 by 12 inch card, food imagery, a strong headline, and QR ordering. Do not reproduce a menu item that is not on the brief.",
    imageryNotes:
      "Food photography as the ground, with a quiet area for the headline. Not a logo, not a map, and not a collage of every plate.",
    ctaNotes: "A QR or a simple order line. One path.",
    whyItWorks: "The food is the interrupt, and ordering is obvious.",
  },
  {
    mmrId: "MMR-011",
    vertical: "fitness",
    format: "postcard",
    dimensions: "A5 (about 5.8 x 8.3 in)",
    packGroup: "craft_exemplar",
    confidence: "high",
    principles: [
      "A premium piece is quieter and physically more considered. A coupon shout cheapens it.",
      "Refer to a prior relationship only with facts on the brief. Do not invent a membership history.",
      "Change the verb on the single action before redesigning the whole card.",
      "Pictures of the real place only. If you do not have them, do not fake a luxury interior.",
    ],
    compositionNotes:
      "An A5 postcard on substantial stock, with facility imagery and a QR-led action. The exact front and back diagram was not published.",
    imageryNotes:
      "The place itself, calm and specific. Not a sweaty stock scene, and not a button-shaped action.",
    ctaNotes:
      "One scan line. The source tested wording, not a pile of buttons.",
    whyItWorks:
      "Restraint, real photography, and one precise action read as premium. A card full of badges does not.",
  },
  {
    mmrId: "MMR-013",
    vertical: "remodeling",
    format: "postcard",
    dimensions: "6 x 11 in",
    packGroup: "craft_exemplar",
    confidence: "high",
    principles: [
      "A jumbo card is not permission to give every element the same weight.",
      "One offer leads. A free estimate is the second line only when the brief includes it. A single review sits near the action.",
      "A service list is support, not a second headline row.",
      "A percent-off without the brief's actual number is a fake. Copy the offer exactly or leave it off.",
    ],
    compositionNotes:
      "A 6 by 11 inch card that carried a discount, a service list, a QR, one testimonial, and a free estimate. The lesson is hierarchy: those elements were all present, and the failure mode is letting them tie.",
    imageryNotes:
      "The photograph was not fully described. Do not invent a room photo as proof of this customer's work.",
    ctaNotes: "The estimate, with the QR as the same action.",
    whyItWorks:
      "The useful pattern is one loud offer, one way to talk, and one proof. The failure mode is a badge farm on a big card.",
  },
  {
    mmrId: "MMR-060",
    vertical: "jewelry",
    format: "postcard",
    dimensions: "4.25 x 6 in",
    packGroup: "craft_exemplar",
    confidence: "high",
    principles: [
      "A small card can be the premium choice. Bigger is not automatically better.",
      "One product photograph, one modest offer, one review, and one way to see more.",
      "A deep discount trains the wrong expectation for a considered purchase. Keep the offer as quiet as the brief allows.",
      "Do not paste product art you do not have the right to use. No specimen image ships with this card.",
    ],
    compositionNotes:
      "A mini postcard: product photo, an offer code, one review, and a website. Not a sale poster.",
    imageryNotes:
      "The object, photographed cleanly, with space around it. Not a lifestyle collage and not a watermark.",
    ctaNotes: "One code or one visit path.",
    whyItWorks:
      "It looks like the object being sold, not like an advertisement for advertising.",
  },
]

const EXPECTED_GROUP_COUNTS: Record<ReferenceCardPackGroup, number> = {
  home_services: 10,
  local_healthcare: 4,
  hospitality: 3,
  craft_exemplar: 3,
}

const BANNED_IN_CARD_TEXT = [
  /https?:\/\//i,
  /postcardmania/i,
  /whosmailingwhat/i,
  /\broi\b/i,
  /ridge vents?/i,
  /\.jpg\b/i,
  /\.png\b/i,
  /equinox/i,
  /seoul/i,
  /piccadilly/i,
  /weed man/i,
  /typeRole/,
  /imagePresence/,
  /leadJob/,
  /imageryRole/,
  /layoutVariant/,
  /source_url/i,
]

export function assertResearchTastePack(
  pack: readonly ReferenceCard[] = RESEARCH_TASTE_PACK
): void {
  if (pack.length !== 20) {
    throw new Error(`Taste pack must contain 20 cards (has ${pack.length}).`)
  }
  const ids = new Set<string>()
  const counts: Record<ReferenceCardPackGroup, number> = {
    home_services: 0,
    local_healthcare: 0,
    hospitality: 0,
    craft_exemplar: 0,
  }
  for (const card of pack) {
    assertReferenceCard(card)
    if (ids.has(card.mmrId)) {
      throw new Error(`Duplicate reference card ${card.mmrId}.`)
    }
    ids.add(card.mmrId)
    counts[card.packGroup] += 1
    const blob = [
      card.mmrId,
      card.dimensions ?? "",
      ...card.principles,
      card.compositionNotes,
      card.imageryNotes,
      card.ctaNotes,
      card.whyItWorks,
    ].join("\n")
    for (const pattern of BANNED_IN_CARD_TEXT) {
      if (pattern.test(blob)) {
        throw new Error(
          `Reference card ${card.mmrId} contains banned text ${pattern}.`
        )
      }
    }
  }
  for (const group of Object.keys(EXPECTED_GROUP_COUNTS) as ReferenceCardPackGroup[]) {
    if (counts[group] !== EXPECTED_GROUP_COUNTS[group]) {
      throw new Error(
        `Taste pack group ${group} has ${counts[group]} cards, expected ${EXPECTED_GROUP_COUNTS[group]}.`
      )
    }
  }
}
