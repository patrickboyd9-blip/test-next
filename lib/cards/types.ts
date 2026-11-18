import type { CardAudience } from "./pricing"
import type { CardNote } from "./note"

export type CardStatus = "scheduled" | "locked" | "queued" | "mailed"

export interface CardPerson {
  id: string
  ownerId: string
  audience: CardAudience
  name: string
  month: number
  day: number
  address1: string
  address2: string
  city: string
  state: string
  zip: string
  yearlyRepeat: boolean
  createdAt: string
}

export interface GreetingCard {
  id: string
  ownerId: string
  personId: string
  audience: CardAudience
  year: number
  birthdayOn: string
  mailDate: string
  recommendedOrderDate: string
  lockDate: string
  mayArriveLate: boolean
  status: CardStatus
  priceCents: number | null
  charged: boolean
  mailed: false
  note: CardNote
  qrCode: string | null
  createdAt: string
  updatedAt: string
}

export interface CardRedirect {
  code: string
  ownerId: string
  cardId: string
  destination: string
  scans: number
}

export function cardIsLocked(card: Pick<GreetingCard, "status">): boolean {
  return card.status !== "scheduled"
}
