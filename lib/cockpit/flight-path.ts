/** Geometry for the home-screen mail flight. The glide in the slot is unchanged. */

export const FLIGHT_MS = 4200
export const IDLE_MS = 5 * 60 * 1000

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
  const riseIn = { x: start.x + 18, y: start.y - (start.y - rise.y) * 0.45 }
  const riseOut = { x: rise.x - 6, y: rise.y + (start.y - rise.y) * 0.28 }
  const crestIn = { x: rise.x + 8, y: crest.y - 8 }
  const crestOut = { x: (rise.x + crest.x) / 2, y: crest.y - 22 }
  const dipIn = { x: crest.x + (dip.x - crest.x) * 0.35, y: crest.y + 8 }
  const dipOut = { x: dip.x - 12, y: (crest.y + dip.y) / 2 }
  const slotIn = { x: dip.x + (slot.x - dip.x) * 0.28, y: dip.y - 10 }
  const slotOut = { x: (dip.x + slot.x) / 2, y: slot.y + 6 }
  return [
    `M ${px(start.x)} ${px(start.y)}`,
    `C ${px(riseIn.x)} ${px(riseIn.y)}, ${px(riseOut.x)} ${px(riseOut.y)}, ${px(rise.x)} ${px(rise.y)}`,
    `C ${px(crestIn.x)} ${px(crestIn.y)}, ${px(crestOut.x)} ${px(crestOut.y)}, ${px(crest.x)} ${px(crest.y)}`,
    `C ${px(dipIn.x)} ${px(dipIn.y)}, ${px(dipOut.x)} ${px(dipOut.y)}, ${px(dip.x)} ${px(dip.y)}`,
    `C ${px(slotIn.x)} ${px(slotIn.y)}, ${px(slotOut.x)} ${px(slotOut.y)}, ${px(slot.x)} ${px(slot.y)}`,
  ].join(" ")
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
