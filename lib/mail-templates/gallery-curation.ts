import { servicePhotoPromptFailures } from "@/lib/campaign-creator/photography-shot-list"

/**
 * Patrick's review of the 168 background photos.
 * Three dental scenes stay as they are. Nine are redone. Every other background photo is unlisted.
 * Finished example mailers in gallery-finished.json are a different set and are not part of this cut.
 */

export const GALLERY_KEEP_IDS = ["dental-scene-12", "dental-scene-13", "dental-scene-18"] as const

export const GALLERY_REDO_IDS = [
  "auto-repair-brake-check",
  "auto-repair-inspection",
  "dental-first-visit",
  "realestate-home-value",
  "restaurant-grand-opening",
  "auto-repair-scene-01",
  "auto-repair-scene-16",
  "hvac-scene-01",
  "restaurant-scene-04",
] as const

export type GalleryRedoId = (typeof GALLERY_REDO_IDS)[number]
export type GalleryRedoLayout = "fade" | "framed" | "split"

export interface GalleryRedoCopy {
  id: GalleryRedoId
  name: string
  summary: string
  headline: string
  subheadline: string
  body: string
  offer: string
  callToAction: string
  layout: GalleryRedoLayout
  /** Imagen 4 aspect before the postcard crop. */
  aspectRatio: "16:9" | "3:4" | "4:3"
  ink: string
  paper: string
  accent: string
  /** Lines painted on the postcard, in order. The photograph itself has no lettering. */
  lines: { text: string; role: "offer" | "headline" | "support" }[]
  prompt: string
}

const CLEAR =
  "What this business does must be unmistakable at postcard size, not generic handiwork and not a stock pose."
const HEAD =
  "If a person is in the frame, their entire head, hair, and chin sit fully inside the picture with open space above the hair."
const CLEAN =
  "No logos, no badges, no brand labels, no trademarks, no readable lettering, no license plate. Exactly the people described, each with exactly two hands and no extra fingers or limbs. Single photograph, one scene, not a collage, no split screen."

export const GALLERY_REDOS: readonly GalleryRedoCopy[] = [
  {
    id: "auto-repair-brake-check",
    name: "Stop Worrying Every Stop",
    summary: "A finished brake job in a real shop, with fifty dollars off.",
    headline: "Stop Worrying Every Stop",
    subheadline: "Leave with brakes that feel sure.",
    body: "The car is back on the ground, the stop is clean, and the shop writes down what it found.",
    offer: "$50 off brake service",
    callToAction: "Book the brake visit",
    layout: "fade",
    aspectRatio: "16:9",
    ink: "#fff8f2",
    paper: "#1c1917",
    accent: "#e36a2e",
    lines: [
      { role: "offer", text: "$50 OFF" },
      { role: "headline", text: "Stop worrying every stop" },
      { role: "support", text: "Brake service, done right" },
    ],
    prompt: `A documentary photograph inside a tidy independent auto repair shop that is obviously a garage. A generic sedan with no grille badge is on a lift, the brake job finished: a clean new rotor and a wheel ready to go back on. One ordinary adult mechanic about 40, natural skin, entire head inside the frame, stands beside the wheel looking at the work, not at the camera. Orange and teal painted blocks on the back wall, a swept concrete floor, unmarked tools. Warm daylight from the open bay. ${HEAD} ${CLEAR} ${CLEAN}`,
  },
  {
    id: "auto-repair-inspection",
    name: "Ready For The Road",
    summary: "A mechanic finishes a car so the next trip can start.",
    headline: "Ready For The Road",
    subheadline: "Spend the trip on the road.",
    body: "Lights, tires, and fluids are checked, and you drive away knowing the car is ready.",
    offer: "$49 off a full check",
    callToAction: "Book the check",
    layout: "framed",
    aspectRatio: "16:9",
    ink: "#1b2430",
    paper: "#fff6e8",
    accent: "#e23d2b",
    lines: [
      { role: "offer", text: "$49 OFF" },
      { role: "headline", text: "Ready for the road" },
      { role: "support", text: "A full check before you go" },
    ],
    prompt: `A colorful independent auto shop with bold red, gold, and deep blue painted wall blocks. One ordinary adult mechanic about 35, natural skin, entire head inside the frame, is actually fixing a generic sedan: both hands on a plain wrench at the wheel, the car looking cared for and nearly ready to drive. No badges. Bright, upbeat, professional. ${HEAD} ${CLEAR} ${CLEAN}`,
  },
  {
    id: "dental-first-visit",
    name: "Love Your Smile Again",
    summary: "A bright first visit with a real price and a happy smile.",
    headline: "Love Your Smile Again",
    subheadline: "Exam, X-rays, and a cleaning.",
    body: "A clean smile and a clear plan, with the price said up front.",
    offer: "$89 new-patient visit",
    callToAction: "Reserve a visit",
    layout: "fade",
    aspectRatio: "16:9",
    ink: "#17343a",
    paper: "#fff6ee",
    accent: "#0e7c86",
    lines: [
      { role: "offer", text: "$89" },
      { role: "headline", text: "Love your smile again" },
      { role: "support", text: "New-patient visit, one price" },
    ],
    prompt: `A sunlit, colorful dental office that feels welcoming, not clinical or scary. Coral chairs, a teal wall, warm wood, and a plant. One adult about 32 with natural skin texture and a real, slightly imperfect happy smile, entire head inside the frame, looking just off camera, proud and relaxed. A dental chair sits softly out of focus behind them so the place is clearly a dental office. No instruments in the foreground, no blood, no charts. Natural window light, fine grain, not plastic skin. ${HEAD} ${CLEAR} ${CLEAN}`,
  },
  {
    id: "realestate-home-value",
    name: "Worth More Than You Think",
    summary: "A loved, finished house and a plain story about what it may be worth.",
    headline: "Worth More Than You Think",
    subheadline: "Know your number, then decide.",
    body: "Recent sales nearby can change the plan. This is a snapshot from a local agent, not an appraisal.",
    offer: "Free home value snapshot",
    callToAction: "Request a snapshot",
    layout: "split",
    aspectRatio: "3:4",
    ink: "#24301c",
    paper: "#f6f3ec",
    accent: "#3f6212",
    lines: [
      { role: "headline", text: "Worth more than you think" },
      { role: "support", text: "Know your number. Then decide." },
      { role: "offer", text: "Free home value snapshot" },
    ],
    prompt: `The finished front of a beautiful move-in-ready craftsman house at golden hour. Fresh paint, a flowered porch, a tidy walkway, warm lamps in the windows. The house looks loved and complete. No sign, no people, no construction. ${CLEAR} ${CLEAN}`,
  },
  {
    id: "restaurant-grand-opening",
    name: "Come Hungry Tonight",
    summary: "A real restaurant's opening night, bold and colorful.",
    headline: "Come Hungry Tonight",
    subheadline: "Be first through the door.",
    body: "A full dining room, real plates, and ten dollars off any order during opening week.",
    offer: "$10 off opening week",
    callToAction: "Reserve a table",
    layout: "fade",
    aspectRatio: "16:9",
    ink: "#fff7ed",
    paper: "#3f1d12",
    accent: "#f6c445",
    lines: [
      { role: "offer", text: "$10 OFF" },
      { role: "headline", text: "Come hungry tonight" },
      { role: "support", text: "Opening week at a real table" },
    ],
    prompt: `A real restaurant dining room on grand-opening night, clearly not a house. A bar, a pass window, set tables, pendant lights, colorful plates of finished food, coral and gold flowers. One adult guest about 30, natural skin, entire head inside the frame, laughing toward a friend whose face is turned away. Saturated, exciting, celebratory. ${HEAD} ${CLEAR} ${CLEAN}`,
  },
  {
    id: "auto-repair-scene-01",
    name: "Your Car, Fixed Right",
    summary: "A tidy shop and a car that is fixed.",
    headline: "Your Car, Fixed Right",
    subheadline: "Find a shop you'll actually trust.",
    body: "The repair is finished in a clean bay, and forty dollars comes off the visit.",
    offer: "$40 off any repair",
    callToAction: "Book the repair",
    layout: "fade",
    aspectRatio: "16:9",
    ink: "#f8fafc",
    paper: "#111827",
    accent: "#f59e0b",
    lines: [
      { role: "offer", text: "$40 OFF" },
      { role: "headline", text: "Your car, fixed right" },
      { role: "support", text: "Any repair, this visit" },
    ],
    prompt: `A tidy independent auto repair shop, obviously a garage: swept floor, organized unmarked tool wall, a two-post lift. A generic sedan with no badges is on the lift and the repair looks finished, the car ready to come down. One ordinary adult mechanic about 38, natural skin, entire head inside the frame, is making the last check with exactly two hands on the work, not posing. Bright and professional. ${HEAD} ${CLEAR} ${CLEAN}`,
  },
  {
    id: "auto-repair-scene-16",
    name: "A Clear View Ahead",
    summary: "A newer car, ready to drive, with the washer filled.",
    headline: "A Clear View Ahead",
    subheadline: "See the road on the way out.",
    body: "A quick fluid top-off on a car that already looks cared for.",
    offer: "$25 off washer service",
    callToAction: "Book the service",
    layout: "fade",
    aspectRatio: "16:9",
    ink: "#0f172a",
    paper: "#f8fafc",
    accent: "#0284c7",
    lines: [
      { role: "offer", text: "$25 OFF" },
      { role: "headline", text: "A clear view ahead" },
      { role: "support", text: "Washer service, done in minutes" },
    ],
    prompt: `An upbeat, professional auto shop in daylight. A nicer recent unbranded midsize sedan, simple grille, no badges, hood area open only enough to show a plain washer reservoir. One ordinary adult about 33, natural skin, entire head inside the frame, calmly pours washer fluid from a plain unlabeled jug, exactly two hands, a small genuine smile toward the work. The car looks polished and ready. ${HEAD} ${CLEAR} ${CLEAN}`,
  },
  {
    id: "hvac-scene-01",
    name: "Cool Nights All Summer",
    summary: "A cool, comfortable home, with a tune-up price on the card.",
    headline: "Cool Nights All Summer",
    subheadline: "Comfort that's ready before the heat.",
    body: "Book the tune-up now and walk into a cool house on the hottest day.",
    offer: "$89 off a tune-up",
    callToAction: "Book the tune-up",
    layout: "fade",
    aspectRatio: "16:9",
    ink: "#f8fafc",
    paper: "#0f2744",
    accent: "#38bdf8",
    lines: [
      { role: "offer", text: "$89 OFF" },
      { role: "headline", text: "Cool nights all summer" },
      { role: "support", text: "Tune-up before the heat" },
    ],
    prompt: `The outcome of a finished cooling tune-up: a beautiful, calm living room that feels cool on a hot afternoon. Sheer curtains, a glass of water with condensation, soft blue shade inside, harsh summer sun on the lawn outside. Through the window, a new quiet outdoor air-conditioner condenser sits alone on a neat pad, no logos. No people. ${CLEAR} ${CLEAN}`,
  },
  {
    id: "restaurant-scene-04",
    name: "Worth Leaving Home For",
    summary: "A rustic restaurant, colorful and full of a finished meal.",
    headline: "Worth Leaving Home For",
    subheadline: "Your next go-to, just down the street.",
    body: "Stone, timber, and a table of food worth the trip, with fifteen dollars off the first meal.",
    offer: "$15 off your first meal",
    callToAction: "Reserve a table",
    layout: "fade",
    aspectRatio: "16:9",
    ink: "#fff7ed",
    paper: "#431407",
    accent: "#fb7185",
    lines: [
      { role: "offer", text: "$15 OFF" },
      { role: "headline", text: "Worth leaving home for" },
      { role: "support", text: "First meal at the rustic table" },
    ],
    prompt: `A rustic restaurant dining room, clearly a restaurant and not a home: several set tables, a bar back, a service pass, stone and timber. Keep the rustic setting, but make it colorful: wildflowers, painted ceramic plates, a finished roast and warm bread on the nearest table, saturated amber light. No people. No readable chalkboard. ${CLEAR} ${CLEAN}`,
  },
]

const redoById = new Map(GALLERY_REDOS.map((redo) => [redo.id, redo]))

const listed = new Set<string>([...GALLERY_KEEP_IDS, ...GALLERY_REDO_IDS])

export function isListedBackgroundPhoto(id: string): boolean {
  return listed.has(id)
}

export function galleryRedoCopy(id: string): GalleryRedoCopy | null {
  return redoById.get(id as GalleryRedoId) ?? null
}

/** Prompt problems that would make a redo unsafe to send to the image model. */
export function galleryRedoPromptFailures(redo: GalleryRedoCopy): string[] {
  const failures = servicePhotoPromptFailures(redo.prompt)
  if (!/no logos/i.test(redo.prompt)) failures.push("missing logo refusal")
  if (/\b(ford|chevrolet|toyota|honda|bmw|mercedes|invisalign|nike|coca-cola)\b/i.test(redo.prompt)) {
    failures.push("prompt names a trademark")
  }
  if (redo.layout !== "split" && !/\$\d+/.test(redo.offer)) failures.push("missing dollar offer")
  if (redo.layout === "split" && !/snapshot/i.test(redo.offer)) failures.push("missing valuation offer")
  return failures
}
