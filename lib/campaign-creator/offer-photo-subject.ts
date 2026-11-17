/**
 * The photo has to show what the offer sells. A water-heater offer shows a
 * water heater; a realtor shows the house; a dentist shows an operatory.
 * Returns null when the trade's own scene bank already fits.
 */
export function offerPhotoSubject(trade: string | undefined, offerText: string): string | null {
  const t = (trade ?? "").toLowerCase()
  const o = offerText ?? ""
  if (t === "plumbing") {
    if (/\b(?:tankless|water heater|hot water)\b/i.test(o)) {
      return /\btankless\b/i.test(o)
        ? "A plumber in work clothes mounting a new white tankless water heater on a clean garage wall, copper and PEX lines and the gas line visible, face visible, daylight from the open garage door. The water heater is the subject."
        : "A plumber in work clothes connecting a new tall white tank water heater in a clean garage or utility closet, copper supply lines and the shutoff valve in frame, face visible, warm working light. The water heater is clearly the subject."
    }
    if (/\b(?:drain|sewer|clog|rooter|hydro-?jet)/i.test(o)) {
      return "A plumber feeding a drain-cleaning cable machine into a cleanout beside a house, the machine and cable clearly visible, face visible, daylight."
    }
    if (/\b(?:leak|repipe|pipe|slab)\b/i.test(o)) {
      return "A plumber under a kitchen sink replacing a supply line with a wrench, cabinet doors open, the pipes clearly visible, face visible."
    }
    return null
  }
  if (t === "dental") {
    if (/\bimplant/i.test(o)) return "A dentist in a white coat showing a smiling adult patient a dental implant model in a bright dental operatory, the dental chair and overhead light behind them."
    if (/\b(?:aligner|invisalign|braces|ortho)/i.test(o)) return "A dentist handing a smiling adult patient a clear aligner tray in a bright dental operatory, the dental chair behind them."
    if (/\bwhiten/i.test(o)) return "A smiling adult patient in a dental chair holding a hand mirror after whitening, a dentist beside them, bright operatory."
    if (/\b(?:emergenc|toothache|same[- ]day)/i.test(o)) return "A dentist gently examining a patient in a dental chair in a bright operatory, overhead lamp on, calm and reassuring."
    return "A friendly hygienist in scrubs beside a patient reclined in a dental chair in a bright, modern dental operatory, overhead light and instrument tray visible, window daylight. A real operatory, not a storefront."
  }
  if (t === "real-estate-agents" || t === "real_estate") {
    if (/\b(?:staging|interior|cleaning credit)/i.test(o) && !/\bexterior\b/i.test(o)) {
      return "The front exterior of a well-kept two-story single-family home in warm late-afternoon light, fresh landscaping, a blank real-estate yard sign at the lawn edge. The house is the subject, no people, no readable text."
    }
    return "The front exterior of a well-kept single-family home in warm daylight, a blank real-estate yard sign on a post at the lawn edge, green lawn, the house fills the frame, no people, no readable text."
  }
  if (t === "pest" || t === "pest-control") {
    if (/\btermite/i.test(o)) return "A pest-control technician in a uniform shirt with a flashlight inspecting the wood sill and foundation of a house, kneeling, face visible, daylight."
    if (/\b(?:rodent|mice|mouse|rat)s?\b/i.test(o)) return "A pest-control technician sealing a small gap at the base of a house's foundation with a caulk gun, face visible, daylight."
    if (/\bmosquito|\btick/i.test(o)) return "A pest-control technician with a backpack mister treating shrubs at the edge of a backyard lawn, face visible, daylight."
    return "A pest-control technician in a uniform shirt with a handheld sprayer treating the exterior foundation perimeter of a well-kept house, face visible, daylight, the house behind."
  }
  if (t === "hvac") {
    if (/\bfurnace|\bheat(?:ing)?\b/i.test(o)) return "An HVAC technician servicing an open gas furnace in a clean basement or utility closet, gauges and tools visible, face visible."
    if (/\b(?:ac|a\/c|air condition|cooling)\b/i.test(o)) return "An HVAC technician with a gauge set checking an outdoor AC condenser beside a house, face visible, daylight."
  }
  return null
}
