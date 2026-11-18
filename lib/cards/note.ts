export const MESSAGE_LIMIT = 300

export const CARD_FONTS = [
  { id: "hand-1", label: "Handwriting" },
  { id: "hand-2", label: "Soft script" },
  { id: "hand-3", label: "Printed hand" },
  { id: "clean", label: "Clean" },
  { id: "serif", label: "Classic serif" },
  { id: "playful", label: "Playful" },
  { id: "script", label: "Script" },
  { id: "rounded", label: "Rounded" },
  { id: "condensed", label: "Condensed" },
  { id: "classic", label: "Classic" },
] as const

export const CARD_INK_COLORS = [
  { id: "black", label: "Black", hex: "#1A1A1A" },
  { id: "navy", label: "Navy", hex: "#1B2A4A" },
  { id: "forest", label: "Forest", hex: "#1E3A2F" },
  { id: "burgundy", label: "Burgundy", hex: "#6B2430" },
  { id: "charcoal", label: "Charcoal", hex: "#333333" },
  { id: "brown", label: "Brown", hex: "#4A2E1F" },
  { id: "plum", label: "Plum", hex: "#4A2748" },
  { id: "teal", label: "Deep teal", hex: "#0F3D3E" },
] as const

export type CardFontId = (typeof CARD_FONTS)[number]["id"]
export type CardInkId = (typeof CARD_INK_COLORS)[number]["id"]

export interface CardNote {
  message: string
  fontId: CardFontId
  inkColorId: CardInkId
}

export function parseCardNote(input: { message?: string; fontId?: string; inkColorId?: string }): CardNote {
  const message = (input.message ?? "").trim()
  if ([...message].length > MESSAGE_LIMIT) throw new Error("Keep the note to 300 characters.")
  const font = CARD_FONTS.find((item) => item.id === input.fontId)
  const ink = CARD_INK_COLORS.find((item) => item.id === input.inkColorId)
  if (!font) throw new Error("Choose one of the card fonts.")
  if (!ink) throw new Error("Choose one of the ink colors.")
  return { message, fontId: font.id, inkColorId: ink.id }
}

export const DEFAULT_NOTE: CardNote = { message: "", fontId: "clean", inkColorId: "black" }
