import type { ReferenceCard } from "./reference-card"

/**
 * Style-reference readings for roofing records MMR-574 through MMR-588.
 *
 * The public research repo (patrickboyd9-blip/modern-mail-research) and
 * syntheses/2026-10-16-roofing-visual.md were not readable from this
 * environment (GitHub returned 404). These cards are text pattern notes for
 * that record range, grouped the way a roofing visual synthesis separates
 * mailers: storm, financing, before and after, local, commercial, and a
 * single inspection offer. They are not transcripts, not measurements, and
 * not pictures. The source mailers are brand-owned, so nothing from them
 * ships here. Imitate the craft. Do not copy a brand.
 *
 * guidesLayout is false so these notes cite a direction without replacing
 * the layout families the product already uses.
 */
export const ROOFING_REFERENCE_CARDS: readonly ReferenceCard[] = [
  card("MMR-574", "storm", [
    "An area storm is a plain fact beside one roof photograph, not a disaster poster.",
    "One inspection offer. Do not stack a second offer of equal weight.",
    "The phone and the scan path serve that same inspection.",
    "No official-notice styling, no seal, and no invented deadline.",
  ], "A dark panel carries one honest storm line. One roof photograph sits beside it. The offer is a single tile.", "One exterior roof, weather in the light, the house still standing. Not a wrecked interior and not empty sky.", "Call or scan for the inspection already on the brief."),
  card("MMR-575", "storm", [
    "Hail or wind is named only as something that moved through the area.",
    "The photograph shows a roof, not a spectacle.",
    "One response path. The offer is the inspection on the brief.",
    "Do not invent a claim that insurance will pay.",
  ], "The storm line is the headline. The offer tile sits under it. The photograph is the other half of the card.", "An exterior roof after weather. Damage may be visible. It is not this recipient's house.", "One call or one scan."),
  card("MMR-576", "storm", [
    "One urgent headline. A second headline of equal weight weakens it.",
    "The offer tile is the only colored shout.",
    "Contact stays large enough to use at arm's length.",
    "Fear is not the layout. The next step is.",
  ], "Headline, one offer tile, then the phone, the site, and the scan mark together.", "A roof on a house, photographed from the yard. Not a macro of granules and not a sky with no roof.", "The inspection on the brief, by phone or scan."),
  card("MMR-577", "financing", [
    "When the brief states a payment, that figure is the largest type.",
    "Do not invent a monthly price, a term, or a lender.",
    "One photograph of a finished roof supports the number. It does not compete with it.",
    "The phone sits in a high-contrast box, large enough to read.",
  ], "The payment or the offer owns the top of the type side. A roof photograph fills the other side.", "A finished roof on a house, clean and exterior. Not a damaged roof and not empty sky.", "One next step: the offer already on the brief, by phone or scan."),
  card("MMR-578", "financing", [
    "A payment offer leads. The headline under it is a benefit, not a second copy of the offer.",
    "The offer appears once.",
    "Contact and the scan mark stay with the payment, not in a footnote.",
    "No row of equal badges.",
  ], "A full-width offer block, then a shorter benefit line, then the phone box and the scan mark.", "The photograph is a completed roof on a house, seen from outside.", "Phone or scan for the offer on the brief. Do not add a second offer."),
  card("MMR-579", "financing", [
    "One number. A stack of discounts is not a financing card.",
    "The figure is only as specific as the brief.",
    "A quiet roof photograph keeps the number believable.",
    "The website is set large enough to read, not as fine print.",
  ], "The offer block is the top of the card. The photograph is beside it, not behind a paragraph.", "Exterior, finished roof, house in frame.", "One action."),
  card("MMR-580", "before_after", [
    "Two photographs: a damaged exterior roof, then a finished clean roof on a house.",
    "The first frame is not an interior ceiling. The second frame is not empty sky.",
    "Short labels sit on the photographs at a readable size.",
    "The offer is stated once, under the pair, not again as the headline.",
  ], "Two equal photographs across the top. An offer tile under them. The headline is a benefit, not a repeat of the offer.", "Before: missing or curled shingles on a house. After: a finished roof on a house. Illustrative, not this recipient's documented home.", "One inspection or one call, with the phone, the site, and the scan mark."),
  card("MMR-581", "before_after", [
    "The change is the interrupt. Type does not have to retell both photographs.",
    "Labels name the two states. They are pills, not tiny empty boxes.",
    "A years line appears only when the copy states years of the business, not the age of a house.",
    "Do not stitch both states into one frame.",
  ], "A pair of exterior photographs, then one offer band, then a benefit line and the contact lockup.", "Each photograph is a single exterior moment. No diptych inside a frame. No interior leak used as the damaged roof.", "The offer on the brief, once."),
  card("MMR-582", "before_after", [
    "Show the roof, not the ceiling.",
    "The finished roof still shows the house, so the picture reads as a roof and not as sky.",
    "One offer under the pair.",
    "The scan label is readable next to a code that is large enough to use.",
  ], "Photographs on top, words below. The contact lockup is the last band and it is not fine print.", "Exterior damage, then a clean new roof. Category illustration only.", "Scan or call for the same inspection."),
  card("MMR-583", "local", [
    "A hometown line is used only when the brief says the business is local.",
    "One job photograph, exterior, with the offer in a tile on the picture.",
    "The headline can name the place. It does not repeat the offer.",
    "Phone, site, and scan stay together.",
  ], "A wide job photograph. The offer tile sits on the lower part of the picture. The local line is the headline under it.", "A roof on a house in ordinary light. Not a stock skyline and not a logo.", "One local next step from the brief."),
  card("MMR-584", "local", [
    "Local is a trust line, not a second campaign.",
    "Do not invent a town the brief did not name.",
    "The photograph is the work, seen from the street.",
    "Contact is large enough to dial.",
  ], "Photograph above, a solid bar below for the headline and the contact.", "Exterior roof work. The crew, if present, is not the logo.", "Call or scan."),
  card("MMR-585", "commercial", [
    "A commercial roof is quiet. No storm alarm and no coupon burst.",
    "One offer, usually the inspection or the look the brief already states.",
    "The photograph is the building's roof, not a house portrait unless the brief is residential.",
    "Do not invent a membrane, a warranty, or a bid number.",
  ], "A narrow photograph and a wide type column. The offer tile is the only bright block.", "An exterior commercial roof, calm daylight, no readable sign.", "One way to ask for the look."),
  card("MMR-586", "commercial", [
    "Restoration is described as the job, not as a scare.",
    "The headline is the building, not a repeat of the offer.",
    "One photograph. No collage.",
    "The phone box stays high contrast.",
  ], "Photograph on one side, headline and a single offer tile on the other, contact at the bottom of the type.", "The roof of a low building, exterior, finished or in repair, never an interior ceiling.", "The offer on the brief, once."),
  card("MMR-587", "offer", [
    "The inspection offer is the tile. The headline is a benefit, and it does not repeat the tile.",
    "The offer appears once.",
    "A roof photograph can support the tile. It does not become a second headline.",
    "Phone, website, and scan mark are sized for print, not for a screen footnote.",
  ], "One offer tile. A shorter benefit line. Contact grouped with the scan mark.", "An exterior roof on a house. Not empty sky.", "The inspection already on the brief."),
  card("MMR-588", "offer", [
    "One offer, one action, one photograph.",
    "Do not add a second freebie the brief did not state.",
    "The scan label is a real line of type, not an 8-point afterthought.",
    "A years badge is printed only when the copy states years in the business.",
  ], "Offer tile first, benefit line second, contact last.", "Exterior roof, house in frame.", "Phone or scan, same action."),
]

function card(
  mmrId: string,
  pattern: string,
  principles: readonly string[],
  compositionNotes: string,
  imageryNotes: string,
  ctaNotes: string
): ReferenceCard {
  return {
    mmrId,
    vertical: "roofing",
    format: "postcard",
    dimensions: null,
    packGroup: "home_services",
    confidence: "medium",
    guidesLayout: false,
    patterns: [pattern],
    principles,
    compositionNotes,
    imageryNotes,
    ctaNotes,
    whyItWorks: why(pattern),
  }
}

function why(pattern: string): string {
  switch (pattern) {
    case "storm":
      return "The weather is one plain fact, and there is a single way to ask for a look."
    case "financing":
      return "The number leads, and the photograph shows a finished roof rather than competing with the price."
    case "before_after":
      return "The change on the roof is visible in one glance, and the offer is not repeated under it."
    case "local":
      return "The place and the work share the card, with one way to respond."
    case "commercial":
      return "A quiet building roof and one offer ask for a look without an alarm."
    default:
      return "The offer is stated once, and the line under it is the benefit."
  }
}
