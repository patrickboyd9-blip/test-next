import { addDays, businessDaysUntil, isoDate, nextBirthday, subtractBusinessDays, type CivilDate } from "./calendar"

/** Placeholder until the printer confirms how many business days a card needs. */
export const DEFAULT_LEAD_BUSINESS_DAYS = 7
export const LEAD_TIME_CONFIRMED = false
export const LOCK_DAYS_BEFORE_MAIL = 7

export interface CardSchedule {
  birthdayOn: string
  mailDate: string
  recommendedOrderDate: string
  lockDate: string
  leadBusinessDays: number
  leadConfirmed: false
  mayArriveLate: boolean
  sendNow: boolean
}

export function scheduleCard(input: {
  month: number
  day: number
  today: CivilDate
  leadBusinessDays?: number
}): CardSchedule {
  const lead = input.leadBusinessDays ?? DEFAULT_LEAD_BUSINESS_DAYS
  if (!Number.isInteger(lead) || lead < 1 || lead > 30) throw new Error("Lead time must be 1 to 30 business days.")
  const birthday = nextBirthday(input.month, input.day, input.today)
  const daysUntil = businessDaysUntil(input.today, birthday)
  const mayArriveLate = daysUntil < lead
  const mail = mayArriveLate ? input.today : subtractBusinessDays(birthday, lead)
  const lock = mayArriveLate ? input.today : addDays(mail, -LOCK_DAYS_BEFORE_MAIL)
  return {
    birthdayOn: isoDate(birthday),
    mailDate: isoDate(mail),
    recommendedOrderDate: isoDate(lock),
    lockDate: isoDate(lock),
    leadBusinessDays: lead,
    leadConfirmed: LEAD_TIME_CONFIRMED,
    mayArriveLate,
    sendNow: mayArriveLate,
  }
}
