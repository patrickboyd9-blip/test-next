/** Geometry for the home-screen mail flight. The glide in the slot is unchanged. */

export const FLIGHT_MS = 8400
export const IDLE_MS = 5 * 60 * 1000
/** The faint slot slip waits this long after a flight ends before its next cycle. */
export const GLIDE_AFTER_FLIGHT_MS = 30_000

export function glideResumesAt(flightEndedMs: number): number {
  return flightEndedMs + GLIDE_AFTER_FLIGHT_MS
}

export interface FlightPoint {
  x: number
  y: number
}

export interface FlightMarks {
  start: FlightPoint
  rise: FlightPoint
  crest: FlightPoint
  dip: FlightPoint
  slot: FlightPoint
}

export function flightAllowed(width: number, reducedMotion: boolean): boolean {
  return width >= 1024 && !reducedMotion
}

/** The existing slip is on screen for this slice of its 18s loop. */
export function glideOccupies(progress: number): boolean {
  const loop = ((progress % 1) + 1) % 1
  return loop > 0.6 && loop < 0.94
}

export function flightPath(marks: FlightMarks): string {
  const { start, rise, crest, dip, slot } = marks
  const towardSlot = unit({ x: Math.max(80, slot.x - dip.x), y: (slot.y - dip.y) * 0.35 })
  const points = [
    { p: start, t: unit({ x: 0.12, y: -1 }) },
    { p: rise, t: unit({ x: 0.18, y: -1 }) },
    { p: crest, t: unit({ x: Math.max(80, dip.x - crest.x), y: (dip.y - crest.y) * 0.42 }) },
    { p: dip, t: towardSlot },
    { p: slot, t: towardSlot },
  ]
  let d = `M ${px(points[0].p.x)} ${px(points[0].p.y)}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i]
    const to = points[i + 1]
    const chord = Math.hypot(to.p.x - from.p.x, to.p.y - from.p.y)
    const handle = chord * (i === 2 ? 0.78 : 0.55)
    const c1 = add(from.p, scale(from.t, handle))
    const c2 = add(to.p, scale(to.t, -handle))
    d += ` C ${px(c1.x)} ${px(c1.y)}, ${px(c2.x)} ${px(c2.y)}, ${px(to.p.x)} ${px(to.p.y)}`
  }
  return d
}

/** Incoming and outgoing handles at each join share a direction. */
export function pathTangentsMeet(path: string): boolean {
  const cubics = path.split(" C ").slice(1).map((part) => part.split(",").map((pair) => pair.trim().split(" ").map(Number)))
  for (let i = 0; i < cubics.length - 1; i += 1) {
    const here = cubics[i]
    const next = cubics[i + 1]
    const join = { x: here[2][0], y: here[2][1] }
    const incoming = unit({ x: join.x - here[1][0], y: join.y - here[1][1] })
    const outgoing = unit({ x: next[0][0] - join.x, y: next[0][1] - join.y })
    if (incoming.x * outgoing.x + incoming.y * outgoing.y < 0.98) return false
  }
  return cubics.length > 1
}

/** Where the existing slip finishes, in the mailbox box. */
export function slotPoint(box: { left: number; top: number; width: number; height: number }): FlightPoint {
  return {
    x: box.left + box.width * 0.311,
    y: box.top + box.height * 0.455,
  }
}

function px(value: number): string {
  return value.toFixed(1)
}

function add(a: FlightPoint, b: FlightPoint): FlightPoint {
  return { x: a.x + b.x, y: a.y + b.y }
}

function scale(a: FlightPoint, amount: number): FlightPoint {
  return { x: a.x * amount, y: a.y * amount }
}

function unit(v: FlightPoint): FlightPoint {
  const length = Math.hypot(v.x, v.y) || 1
  return { x: v.x / length, y: v.y / length }
}
