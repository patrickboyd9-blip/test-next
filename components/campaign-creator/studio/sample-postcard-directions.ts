import type { CreativeSpec } from "@/lib/campaign-creator/types"

export interface SampleDirection {
  vertical: "roofing" | "hvac" | "dental"
  name: string
  spec: CreativeSpec
}

function card(
  vertical: SampleDirection["vertical"],
  name: string,
  spec: CreativeSpec
): SampleDirection {
  return { vertical, name, spec }
}

const roofing = (overrides: Partial<CreativeSpec> = {}): CreativeSpec => ({
  layoutVariant: "image_grounded",
  headline: "Free Roof Inspection",
  subheadline: "We check the roof and the gutters.",
  body: "ABC Roofers looks at what can wait.",
  callToAction: "Book a free inspection",
  offer: "Free roof inspection",
  phone: "(619) 555-0148",
  website: "https://abcroofers.com/inspect",
  qrDestination: "https://abcroofers.com/inspect",
  visualDirection: "Rooflines along a Chula Vista street after rain.",
  tone: "Clear",
  palette: ["#1e3a5f", "#8aa4b5", "#f6f1e7"],
  imagery: "stock_generic_local",
  leadJob: "offer",
  imageryRole: "neighborhood",
  ...overrides,
})

const hvac = (overrides: Partial<CreativeSpec> = {}): CreativeSpec => ({
  layoutVariant: "image_grounded",
  headline: "Same-Day Cooling",
  subheadline: "A tune-up before the heat arrives.",
  body: "Northwind checks the system and the filter.",
  callToAction: "Book a tune-up",
  offer: "Free system tune-up",
  phone: "(512) 555-0194",
  website: "https://northwindair.com/tune-up",
  qrDestination: "https://northwindair.com/tune-up",
  visualDirection: "A quiet condenser beside a shaded Austin house in late afternoon.",
  tone: "Calm",
  palette: ["#1f4e5f", "#d7ecec", "#f4f1ea"],
  imagery: "stock_hvac",
  leadJob: "offer",
  imageryRole: "neighborhood",
  ...overrides,
})

const dental = (overrides: Partial<CreativeSpec> = {}): CreativeSpec => ({
  layoutVariant: "image_grounded",
  headline: "A Calmer Cleaning",
  subheadline: "New patients are welcome this month.",
  body: "Harbor Dental keeps the visit short and clear.",
  callToAction: "Reserve a visit",
  offer: "New patient cleaning",
  phone: "(206) 555-0172",
  website: "https://harbordental.com/visit",
  qrDestination: "https://harbordental.com/visit",
  visualDirection: "Soft morning light in a quiet treatment room, no people, no equipment close-up.",
  tone: "Warm",
  palette: ["#243044", "#e7d7c8", "#f7f4ee"],
  imagery: "stock_generic_local",
  leadJob: "trust",
  imageryRole: "neighborhood",
  ...overrides,
})

/** Three directions each for roofing, HVAC, and dental. */
export const SAMPLE_POSTCARD_DIRECTIONS: readonly SampleDirection[] = [
  card("roofing", "Book In Seconds", roofing({
    layoutVariant: "type_only",
    headline: "Book In Seconds",
    subheadline: "A free roof inspection, on your schedule.",
    callToAction: "Book a time",
    visualDirection: "Type only. Navy field, no photograph.",
    palette: ["#1e3a5f", "#F5C518", "#f4f1ea"],
    imagery: "none",
    imageryRole: "none",
  })),
  card("roofing", "Free Roof Inspection", roofing({
    layoutVariant: "image_grounded",
    headline: "Free Roof Inspection",
    palette: ["#3d4450", "#d9d6d0", "#f4f1ea"],
  })),
  card("roofing", "See The Transformation", roofing({
    layoutVariant: "peer_split",
    headline: "See The Transformation",
    subheadline: "One finished roof.",
    callToAction: "Book the inspection",
    imageryRole: "neighborhood",
    leadJob: "trust",
  })),
  card("hvac", "Same-Day Cooling", hvac()),
  card("hvac", "Before The Heat", hvac({
    layoutVariant: "peer_split",
    headline: "Before The Heat",
    subheadline: "A tune-up while the weather is still kind.",
    callToAction: "Call for a tune-up",
    leadJob: "urgency",
    imageryRole: "consequence",
  })),
  card("hvac", "The Quiet Fix", hvac({
    layoutVariant: "type_only",
    headline: "The Quiet Fix",
    subheadline: "We find the noise before the weekend.",
    callToAction: "Call Northwind",
    visualDirection: "Type only. No photograph.",
    imagery: "none",
    imageryRole: "none",
    palette: ["#14343f", "#f2e6c9", "#f7f4ee"],
  })),
  card("dental", "A Calmer Cleaning", dental()),
  card("dental", "New Patient Visit", dental({
    layoutVariant: "peer_split",
    headline: "New Patient Visit",
    subheadline: "A cleaning, with time to ask questions.",
    callToAction: "Reserve your visit",
  })),
  card("dental", "Call This Week", dental({
    layoutVariant: "type_only",
    headline: "Call This Week",
    subheadline: "New patient cleanings are open.",
    callToAction: "Call the office",
    visualDirection: "Type only. No photograph.",
    imagery: "none",
    imageryRole: "none",
    palette: ["#3d2c29", "#f0d7c4", "#f7f4ee"],
  })),
]
