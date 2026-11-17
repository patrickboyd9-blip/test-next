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
        ? "A plumber in work clothes mounting a new white tankless water heater on a clean garage wall, copper and PEX lines and the gas line visible, wrench on the fittings. The entire head is inside the frame with space above the hair. Daylight from the open garage door. The water heater is the subject, not a portrait."
        : "A plumber in work clothes connecting a new tall white tank water heater with a wrench on the fittings, copper supply lines and the shutoff valve in frame. The entire head is inside the frame with space above the hair. The water heater is clearly the subject, not a person staring at pipes."
    }
    if (/\b(?:drain|sewer|clog|rooter|hydro-?jet)/i.test(o)) {
      return "A plumber feeding a drain-cleaning cable machine into an outdoor cleanout, the machine and the cable large and unmistakable, daylight. The entire head is inside the frame with space above the hair. This is drain cleaning, not a person staring at pipes."
    }
    if (/\b(?:leak|repipe|pipe|slab)\b/i.test(o)) {
      return "A plumber under a kitchen sink tightening a supply line with a wrench, cabinet doors open, the pipes and the wrench clearly visible. The entire head is inside the frame with space above the hair."
    }
    return null
  }
  if (t === "dental") {
    if (/\bimplant/i.test(o)) return "A dentist in a white coat holding a dental implant model so it is large and obvious, seated adult patient in a bright dental operatory, both faces fully in frame with space above the hair. Not two people standing and talking."
    if (/\b(?:aligner|invisalign|braces|ortho)/i.test(o)) return "A dentist in a bright dental operatory holding a clear aligner tray so the transparent tray is large and obvious, seated adult patient in the dental chair, both faces fully in frame with space above the hair. Not two people standing and talking."
    if (/\bwhiten/i.test(o)) return "A seated adult patient in a dental chair holding a hand mirror after whitening, a dentist beside them, bright operatory, both faces fully in frame with space above the hair."
    if (/\b(?:emergenc|toothache|same[- ]day)/i.test(o)) return "A dentist examining a patient reclined in a dental chair, a dental mirror at the patient's mouth, overhead lamp on, both faces fully in frame with space above the hair. The exam is the action."
    return "A hygienist in scrubs actively cleaning a reclined patient's teeth in a bright dental operatory: a dental mirror and scaler are in the patient's mouth, the overhead light is on, and both faces are fully in frame with space above the hair. The checkup is the action. Not someone looking at a cabinet and not a stock portrait."
  }
  if (t === "real-estate-agents" || t === "real_estate") {
    if (/\b(?:staging|interior|cleaning credit)/i.test(o) && !/\bexterior\b/i.test(o)) {
      return "The front exterior of a well-kept two-story single-family home in warm late-afternoon light, fresh landscaping, a blank real-estate yard sign at the lawn edge. The house is the subject, no people, no readable text."
    }
    return "The front exterior of a well-kept single-family home in warm daylight, a blank real-estate yard sign on a post at the lawn edge, green lawn, the house fills the frame, no people, no readable text."
  }
  if (t === "pest" || t === "pest-control") {
    if (/\btermite/i.test(o)) return "A uniformed pest-control technician kneeling at a house foundation, flashlight beam on a visible gray mud tube on the concrete, an inspection mirror in the other hand. The entire head is inside the frame with space above the hair. The mud tube makes this a termite inspection, not generic handiwork."
    if (/\b(?:rodent|mice|mouse|rat)s?\b/i.test(o)) return "A uniformed pest-control technician sealing a small gap at the base of a house foundation with a caulk gun, the gap and the gun unmistakable. The entire head is inside the frame with space above the hair."
    if (/\bmosquito|\btick/i.test(o)) return "A uniformed pest-control technician with a backpack mister spraying shrubs at the edge of a backyard lawn, the mist visible. The entire head is inside the frame with space above the hair."
    return "A uniformed pest-control technician spraying the exterior foundation of a house with a handheld sprayer, mist visible at the foundation. The entire head is inside the frame with space above the hair. The spraying is unmistakable. Not a person merely kneeling."
  }
  if (t === "hvac") {
    if (/\bfurnace|\bheat(?:ing)?\b/i.test(o)) return "An HVAC technician servicing an open gas furnace, gauges on the manifold and the burner visible. The entire head is inside the frame with space above the hair. The furnace service is the action, not a portrait."
    if (/\b(?:ac|a\/c|air condition|cooling)\b/i.test(o)) return "An HVAC technician with a gauge set on an outdoor AC condenser beside a house, coils and copper visible, daylight. The entire head is inside the frame with space above the hair. Not someone standing beside the unit with nothing in their hands."
  }
  return null
}
