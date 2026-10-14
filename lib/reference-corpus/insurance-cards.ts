import type { ReferenceCard } from "./reference-card"

/**
 * Medicare and insurance readings from MMR-513 through MMR-533.
 * Text only. No logos, no specimen art, no source URLs, no vendor math.
 * INTERNAL RESEARCH / REFERENCE ONLY — imitate the craft, not the brand.
 *
 * The batch is the 2026-10-13 Medicare and insurance synthesis. Negative
 * examples stay in the pack as refusals, not as looks to copy.
 */
export const INSURANCE_REFERENCE_CARDS: readonly ReferenceCard[] = [
  {
    mmrId: "MMR-514",
    vertical: "medicare_agent",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "high",
    principles: [
      "Lead with a free plan review or a free consultation. Do not open with a plan pitch.",
      "A real local agent's face is the trust driver when the brief includes that photograph.",
      "Name the real Annual Enrollment window, October 15 through December 7, only when the mailing is actually for that season.",
      "One response path. A phone and a QR may both appear when the brief has them, and they serve that same review.",
    ],
    compositionNotes:
      "Agent-led postcard for people turning 65 or shopping during Annual Enrollment. The offer is the review, not a plan name. Trim size was not observed.",
    imageryNotes:
      "The agent's own headshot, friendly and current. If that photograph is not on the brief, do not invent a face and call it the agent.",
    ctaNotes: "A scan or a call for the free review. One action.",
    whyItWorks:
      "The reader is offered help from a person they can picture, without being sold a plan on the front.",
  },
  {
    mmrId: "MMR-515",
    vertical: "medicare_agent",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "high",
    principles: [
      "A turning-65 sequence can be a calm monthly note. Do not turn it into a countdown the brief does not state.",
      "Put one real review and the years in business next to the agent when those facts are on the brief.",
      "The headshot and the review are one trust stack. Do not add a badge row.",
      "Keep the language plain. The reader should not have to decode insurance jargon.",
    ],
    compositionNotes:
      "A drip postcard aimed at people approaching 65. The front is the person and the offer of a review. Supporting proof sits with the response path.",
    imageryNotes:
      "Agent headshot plus a consented client only when the brief actually includes them. Otherwise use an active, capable older couple, not a frail or clinical scene.",
    ctaNotes: "One way to ask for the review.",
    whyItWorks:
      "Trust is a person, a specific history, and one easy next step.",
  },
  {
    mmrId: "MMR-516",
    vertical: "medicare_agent",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "high",
    principles: [
      "Sound like a local advisor, not a national carrier and not a government office.",
      "A seasonal headline is honest only for the real Annual Enrollment dates. Do not invent a shorter deadline.",
      "Large type. The reader should get the offer without studying the card.",
      "Name the agency as a private business when the brief includes the name.",
    ],
    compositionNotes:
      "Local advisor postcard. One headline, the review, and contact that is easy to find. No official-notice styling.",
    imageryNotes:
      "The advisor's own photograph, or an active older couple in ordinary daylight. Not a capitol, an eagle, a seal, a flag, or a Medicare card.",
    ctaNotes: "Call or scan for the review. One action.",
    whyItWorks:
      "It feels like a neighbor who does this work, which is the reason to respond.",
  },
  {
    mmrId: "MMR-513",
    vertical: "medicare_agent",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "medium",
    principles: [
      "A mail-back path is a useful second way to answer when the brief includes a reply device. It is not a second campaign.",
      "Do not print a fake rush such as a five-day response window. That urgency was a failure mode, not a pattern to copy.",
      "One offer still leads. The reply form supports it.",
      "Say who the sender is. A private agency should be identifiable as a private agency.",
    ],
    compositionNotes:
      "A reply-mail piece. The useful craft is a simple way to respond by mail. The observed rush language is refused.",
    imageryNotes:
      "No government-looking art. The photograph, if any, is the agent or an active older couple.",
    ctaNotes: "The reply path and any scan or phone on the brief serve one request for a review.",
    whyItWorks:
      "Some people would rather mail a card back than call. The piece stays honest about time.",
  },
  {
    mmrId: "MMR-517",
    vertical: "medicare_seminar",
    format: "postcard",
    dimensions: "6 x 11 in",
    packGroup: "insurance",
    confidence: "high",
    principles: [
      "A seminar invitation leads with the person's name when the brief has it, then the meal and the topic.",
      "Use the largest format the piece really is. Do not pretend a small card is a jumbo invite.",
      "Mail one to three weeks before the event. The date on the card must be the real event date.",
      "Say what kind of event it is. Do not disguise a sales meeting as something else.",
    ],
    compositionNotes:
      "An oversized dinner invitation, about 6 by 11 inches. The meal and the date are the interrupt. One way to reserve.",
    imageryNotes:
      "The meal or the room, photographed plainly. Not a government seal and not a stock ballroom that implies a different event.",
    ctaNotes: "Reserve the seat. One action.",
    whyItWorks:
      "The invitation is specific: who it is for, what is served, and when to come.",
  },
  {
    mmrId: "MMR-518",
    vertical: "medicare_seminar",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "medium",
    principles: [
      "A lunch invitation can show the meal on the address side, with the topic list kept short.",
      "First name and a real date. Do not invent either.",
      "One event, one time, one way to say yes.",
      "Keep type large enough to read the date without hunting.",
    ],
    compositionNotes:
      "A lunch seminar card. The meal photograph supports the invitation. The date and the topic stay readable.",
    imageryNotes:
      "The meal itself, appetizing and ordinary. Not a hospital cafeteria and not a patriotic emblem.",
    ctaNotes: "One way to accept the invitation.",
    whyItWorks:
      "The food makes the event concrete, and the date is the only deadline.",
  },
  {
    mmrId: "MMR-519",
    vertical: "medicare_plan",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "high",
    principles: [
      "Show an active, capable older couple doing something they enjoy. That framing beat dependent or isolated portrayals.",
      "Large subheads and open space. Do not fill the card with equal modules.",
      "The photograph is about competence and ease, not decline.",
      "Do not invent plan extras the brief does not list.",
    ],
    compositionNotes:
      "A plan postcard whose winning picture was a capable couple. Type stays large, with room around it.",
    imageryNotes:
      "An active couple, contemporary color, clearly well. Not frail, not in a hospital bed, not a cane or walker as the default, not sepia nostalgia, not an obvious stock model.",
    ctaNotes: "One plain next step already on the brief.",
    whyItWorks:
      "People respond to being seen as capable. The card has room to breathe.",
  },
  {
    mmrId: "MMR-520",
    vertical: "medicare_plan",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "high",
    principles: [
      "Plain language beats insurance jargon.",
      "A serious, branded design can feel important. It must still look like the agency, not like the government.",
      "Do not borrow official-notice cues. A tiny disclaimer does not make those cues acceptable.",
      "One idea leads. Do not stack competing claims.",
    ],
    compositionNotes:
      "The useful lesson is plain speech and a serious layout. Government mimicry is the refused shortcut.",
    imageryNotes:
      "No capitol, eagle, seal, flag, or Medicare card. No red-white-and-blue official styling.",
    ctaNotes: "One clear action in ordinary words.",
    whyItWorks:
      "The card is easy to understand and still looks like a business, not an agency of the government.",
  },
  {
    mmrId: "MMR-521",
    vertical: "medicare_plan",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "high",
    principles: [
      "Lower the number of things the reader must parse. One headline, one offer, one action.",
      "Put a large QR next to the call to action, not in a corner as decoration.",
      "White space is part of the design. Do not fill every gap with a second offer.",
      "Do not add a dollar claim the brief does not state.",
    ],
    compositionNotes:
      "A refreshed plan piece that won by being easier to read. The QR sits with the action.",
    imageryNotes:
      "A calm, relevant photograph with a quiet area for type. Not a busy collage and not another industry's job site.",
    ctaNotes: "The QR and the words beside it are the same action.",
    whyItWorks:
      "The reader can see what to do, and the code is large enough to use.",
  },
  {
    mmrId: "MMR-522",
    vertical: "medicare_plan",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "medium",
    principles: [
      "A self-mailer still needs one lead. Extra panels are not permission for equal offers.",
      "Refresh the words into plain speech rather than adding more modules.",
      "Keep the sender identifiable as the agency on the brief.",
      "Do not import a carrier logo the brief does not authorize.",
    ],
    compositionNotes:
      "A self-mailer refresh. The lesson is hierarchy and plain language, not a diagram to copy.",
    imageryNotes:
      "Relevant people or place only. No government symbols and no unrelated trade photography.",
    ctaNotes: "One action, repeated only if a second panel needs the same path.",
    whyItWorks:
      "The extra paper is used to explain one offer, not to start a second campaign.",
  },
  {
    mmrId: "MMR-523",
    vertical: "medicare_plan",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "high",
    principles: [
      "Straight talk replaced nostalgic creative. Do not use sepia or old-days styling as the idea.",
      "For a supplement conversation, compete on clarity, service, and choice. Do not invent a price.",
      "Front-load the series with the clearest piece. Later cards should not restart the hierarchy.",
      "One promise, in words a person would actually say.",
    ],
    compositionNotes:
      "A supplement series that dropped nostalgic art for plain speech. Type carries the honesty.",
    imageryNotes:
      "Contemporary color. Not sepia, not a faded flag, not a staged 'good old days' scene.",
    ctaNotes: "One way to ask for a straight conversation.",
    whyItWorks:
      "The reader is treated as an adult who wants a clear explanation.",
  },
  {
    mmrId: "MMR-524",
    vertical: "medicare_plan",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "medium",
    principles: [
      "A concrete answer to a real fear, such as whether doctors are nearby, works only when the brief has that fact.",
      "Do not invent physician names, faces, or network status.",
      "If the brief lists real nearby doctors and the use is permitted, they can be the proof. Otherwise leave them off.",
      "One claim. Do not add a stack of extras around it.",
    ],
    compositionNotes:
      "A piece that named nearby doctors. Use that pattern only with facts the brief actually provides.",
    imageryNotes:
      "Real, permitted faces only. Do not paste a stock clinician and call the person a local doctor.",
    ctaNotes: "One way to ask about the plans the agency offers.",
    whyItWorks:
      "It answers a specific worry instead of listing adjectives.",
  },
  {
    mmrId: "MMR-525",
    vertical: "medicare_plan",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "medium",
    principles: [
      "A local plan piece should look local. Do not dress it as a federal notice.",
      "Keep the offer generic and educational unless the brief states a specific, permitted claim.",
      "Large type, short lines, one action.",
      "The agency name belongs on the piece.",
    ],
    compositionNotes:
      "A regional plan postcard. Calm color, readable type, no official-mail costume.",
    imageryNotes:
      "A local scene or a capable couple. Not a capitol and not a stock skyline presented as this town.",
    ctaNotes: "One next step on the brief.",
    whyItWorks:
      "It looks like mail from here, which is easier to trust than mail from nowhere.",
  },
  {
    mmrId: "MMR-526",
    vertical: "medicare_plan",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "medium",
    principles: [
      "Name the agency, and that it is a private business, when the brief includes the name.",
      "Do not use a carrier mark the agent is not authorized to show.",
      "A national-looking package still has to be honest about who sent it.",
      "No government symbols and no implied endorsement.",
    ],
    compositionNotes:
      "A larger insurance package. The craft lesson is identification and restraint, not the insert list.",
    imageryNotes:
      "Nothing that implies a government program. No eagle, seal, flag, or Medicare card.",
    ctaNotes: "One way to reach the named agency.",
    whyItWorks:
      "The reader can tell who is writing and that the writer is not the government.",
  },
  {
    mmrId: "MMR-527",
    vertical: "final_expense",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "high",
    principles: [
      "Do not show the Capitol or any government building. That look is a known enforcement problem, not a tactic.",
      "Do not imply a government program with an eagle, a seal, a flag, or official colors arranged as a notice.",
      "Final expense is family protection. It is not a picture of a casket, a funeral, or grief.",
      "Fear is not the layout. Refuse it even when it would be louder.",
    ],
    compositionNotes:
      "A negative example. The observed capitol illustration is what not to do. Build a plain private-business card instead.",
    imageryNotes:
      "No capitol, no eagle, no seal, no flag, no casket, no cemetery. A living family is the picture if a picture is needed.",
    ctaNotes: "One ordinary way to ask for information. No fake urgency.",
    whyItWorks:
      "The refusal is the lesson. Government costume and funeral imagery are how this category gets people in trouble.",
  },
  {
    mmrId: "MMR-528",
    vertical: "final_expense",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "high",
    principles: [
      "Never write Official Business, or anything that means the same thing.",
      "Do not use the words benefit, entitled, or you qualify. They imply a government status the sender cannot confer.",
      "A small line that says the sender is not the government does not repair an official look.",
      "Name the private business. Do not hide behind a program name.",
    ],
    compositionNotes:
      "A negative example of official-notice styling. The replacement is a clearly private letter with one offer of a conversation.",
    imageryNotes:
      "No notice borders, no eagle, no seal, no Medicare card, no casket.",
    ctaNotes: "A plain request for a conversation. No 'respond within five days.'",
    whyItWorks:
      "People can tell who is asking, and the piece does not pretend to be the government.",
  },
  {
    mmrId: "MMR-529",
    vertical: "life_insurance",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "medium",
    principles: [
      "Keep the offer as plain as the brief. Do not add a test result or a price the brief does not state.",
      "One audience, one reason to look, one way to respond.",
      "Still refuse government-looking cues even though this is not Medicare.",
      "Do not show grief as the motivator.",
    ],
    compositionNotes:
      "A life postcard built around a simple test of the offer. Copy the structure of one idea, not a missing price.",
    imageryNotes:
      "Living people, ordinary light. Not a funeral and not an official emblem.",
    ctaNotes: "One path to the conversation on the brief.",
    whyItWorks:
      "The card asks for one decision and does not costume itself as mail from the government.",
  },
  {
    mmrId: "MMR-530",
    vertical: "life_insurance",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "high",
    principles: [
      "A family photograph can remind the reader why the protection matters, when the picture is of living people.",
      "Do not show a casket, a funeral, or a grief scene. That fear picture is refused.",
      "One reason and one action. Do not add a price the brief does not have.",
      "The family should look connected and well, not posed as a stock ad.",
    ],
    compositionNotes:
      "A life card whose picture was a family. The photograph is the reason. Type stays secondary and readable.",
    imageryNotes:
      "A real-feeling family or multi-generation group, contemporary color. Not a casket, not a cemetery, not an obvious catalog model.",
    ctaNotes: "One way to talk about the coverage on the brief.",
    whyItWorks:
      "The picture is the reason someone would care, and it does not scare them.",
  },
  {
    mmrId: "MMR-531",
    vertical: "auto_insurance",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "medium",
    principles: [
      "A bundle offer leads only when the brief states the bundle. Do not invent the savings.",
      "Any 'save up to' figure must be the figure on the brief. Otherwise leave the number off.",
      "One product story. Do not mix in an unrelated trade.",
      "Still no government-looking design.",
    ],
    compositionNotes:
      "An auto and home bundle postcard. The offer is the bundle the brief names, with one way to check it.",
    imageryNotes:
      "A car, a home, or the household. Not a crash spectacle and not a construction site unless that is the actual business.",
    ctaNotes: "One way to ask for the quote on the brief.",
    whyItWorks:
      "The savings are either real and stated, or they are not on the card.",
  },
  {
    mmrId: "MMR-532",
    vertical: "auto_insurance",
    format: "postcard",
    dimensions: null,
    packGroup: "insurance",
    confidence: "medium",
    principles: [
      "A local agency card uses one review and the years in business when the brief has them.",
      "Shared-route mail still has to look like this agency, not like a national notice.",
      "One offer leads. A service list is support.",
      "Do not invent a discount.",
    ],
    compositionNotes:
      "A local property-and-casualty postcard. Trust sits next to the action. The route is not the design.",
    imageryNotes:
      "The agency's place or a relevant household scene. Not another industry's job site.",
    ctaNotes: "Call or scan for the quote. One action.",
    whyItWorks:
      "It reads as a local shop with a specific history, which is the reason to call.",
  },
  {
    mmrId: "MMR-533",
    vertical: "auto_insurance",
    format: "postcard",
    dimensions: "6 x 9 in",
    packGroup: "insurance",
    confidence: "high",
    principles: [
      "An agent photograph plus a recognizable local scene says neighbor, not national carrier.",
      "No small print as the design. The offer and the action stay large.",
      "Use the agent's real headshot when the brief includes it. Do not swap in a model.",
      "One quote path.",
    ],
    compositionNotes:
      "A 6 by 9 inch card. The agent and the town are the interrupt. Type stays large enough to read at arm's length.",
    imageryNotes:
      "The agent's face and a local place the brief supports. Not a generic skyline and not a hard-hat job site.",
    ctaNotes: "One large way to ask for the quote.",
    whyItWorks:
      "The reader can see a person and a place they recognize, and they can read the offer.",
  },
]
