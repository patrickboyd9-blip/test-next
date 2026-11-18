/** A calendar date. No time and no time zone. */
export interface CivilDate {
  year: number
  month: number
  day: number
}

export function parseIsoDate(iso: string): CivilDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) throw new Error("Use a YYYY-MM-DD date.")
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

export function isoDate(date: CivilDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`
}

export function addDays(date: CivilDate, days: number): CivilDate {
  const utc = Date.UTC(date.year, date.month - 1, date.day + days)
  const next = new Date(utc)
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() }
}

/** 0 is Sunday. */
export function weekday(date: CivilDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()
}

export function isWeekend(date: CivilDate): boolean {
  const day = weekday(date)
  return day === 0 || day === 6
}

/** US federal holiday, including the observed weekday when the holiday falls on a weekend. */
export function isFederalHoliday(date: CivilDate): boolean {
  const stamp = isoDate(date)
  return [date.year - 1, date.year, date.year + 1].some((year) =>
    federalHolidays(year).some((holiday) => isoDate(observed(holiday)) === stamp),
  )
}

export function isBusinessDay(date: CivilDate): boolean {
  return !isWeekend(date) && !isFederalHoliday(date)
}

export function subtractBusinessDays(date: CivilDate, days: number): CivilDate {
  if (days < 0) throw new Error("Lead time cannot be negative.")
  let cursor = date
  let left = days
  while (left > 0) {
    cursor = addDays(cursor, -1)
    if (isBusinessDay(cursor)) left -= 1
  }
  return cursor
}

/** Business days from `from` until `to`, not counting `from`. Negative when `to` is earlier. */
export function businessDaysUntil(from: CivilDate, to: CivilDate): number {
  if (isoDate(from) === isoDate(to)) return 0
  const forward = isoDate(from) < isoDate(to)
  let cursor = from
  let count = 0
  const target = isoDate(to)
  while (isoDate(cursor) !== target) {
    cursor = addDays(cursor, forward ? 1 : -1)
    if (isBusinessDay(cursor)) count += forward ? 1 : -1
  }
  return count
}

export function nextBirthday(month: number, day: number, today: CivilDate): CivilDate {
  if (!validMonthDay(month, day, 2024) && !validMonthDay(month, day, 2023)) {
    throw new Error("That birthday is not a real date.")
  }
  const thisYear = birthdayInYear(month, day, today.year)
  if (isoDate(thisYear) >= isoDate(today)) return thisYear
  return birthdayInYear(month, day, today.year + 1)
}

function birthdayInYear(month: number, day: number, year: number): CivilDate {
  if (validMonthDay(month, day, year)) return { year, month, day }
  if (month === 2 && day === 29) return { year, month: 2, day: 28 }
  throw new Error("That birthday is not a real date.")
}

export function validMonthDay(month: number, day: number, year: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  const probe = new Date(Date.UTC(year, month - 1, day))
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
}

function observed(date: CivilDate): CivilDate {
  const day = weekday(date)
  if (day === 6) return addDays(date, -1)
  if (day === 0) return addDays(date, 1)
  return date
}

function federalHolidays(year: number): CivilDate[] {
  return [
    { year, month: 1, day: 1 },
    nthWeekday(year, 1, 1, 3),
    nthWeekday(year, 2, 1, 3),
    lastWeekday(year, 5, 1),
    { year, month: 6, day: 19 },
    { year, month: 7, day: 4 },
    nthWeekday(year, 9, 1, 1),
    nthWeekday(year, 10, 1, 2),
    { year, month: 11, day: 11 },
    nthWeekday(year, 11, 4, 4),
    { year, month: 12, day: 25 },
  ]
}

function nthWeekday(year: number, month: number, weekdayIndex: number, n: number): CivilDate {
  const first = weekday({ year, month, day: 1 })
  const delta = (weekdayIndex - first + 7) % 7
  return { year, month, day: 1 + delta + (n - 1) * 7 }
}

function lastWeekday(year: number, month: number, weekdayIndex: number): CivilDate {
  const last = addDays({ year, month: month + 1, day: 1 }, -1)
  const delta = (weekday(last) - weekdayIndex + 7) % 7
  return addDays(last, -delta)
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}
