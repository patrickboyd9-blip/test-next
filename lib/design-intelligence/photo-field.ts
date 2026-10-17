import { contrastRatio } from "./contrast"
import type { TypeSeat } from "./rationale"

/**
 * Reads a photograph for a calm patch of sky or wall.
 * Edge density is the local gradient. Skin-toned, high-detail cells are the subject.
 * Type is seated on the calmer side, and never on that subject.
 */

const COLS = 8
const ROWS = 5

export interface PhotoReading {
  seat: TypeSeat
  /** Subject box in fractions of the frame. Empty when no face or figure stands out. */
  subject: { x: number; y: number; w: number; h: number } | null
  cluttered: boolean
  stocky: boolean
  edge: number
}

interface Cell {
  edge: number
  skin: number
  luma: number
  r: number
  g: number
  b: number
}

export function analyzePhotoField(rgba: ArrayLike<number>, width: number, height: number): PhotoReading {
  const cells = sampleCells(rgba, width, height)
  const subjectMarks = cells.map((cell) => cell.edge + cell.skin * 2 > 0.42 || cell.skin > 0.12)
  const subject = subjectBox(subjectMarks)
  const windows = candidateWindows()
  let best = windows[0]!
  let bestScore = Number.POSITIVE_INFINITY
  for (const window of windows) {
    const score = windowScore(cells, subjectMarks, window)
    if (score < bestScore) {
      best = window
      bestScore = score
    }
  }
  const stats = windowStats(cells, best)
  const ink = stats.luma > 0.58 ? "dark" : "light"
  const inkHex = ink === "dark" ? "#161616" : "#F7F4EE"
  const ground = rgbHex(stats.r, stats.g, stats.b)
  const predicted = safeContrast(inkHex, ground)
  const overlap = overlapFraction(subjectMarks, best)
  const scrim = predicted < 7 || stats.edge > 0.18
  const seat: TypeSeat = {
    side: best.x >= 4 ? "right" : "left",
    ink,
    scrim,
    shadow: scrim,
    rect: {
      x: best.x / COLS,
      y: best.y / ROWS,
      w: best.w / COLS,
      h: best.h / ROWS,
    },
  }
  return {
    seat,
    subject,
    cluttered: stats.edge > 0.28 || overlap > 0.2,
    stocky: isStocky(cells, subject),
    edge: round3(stats.edge),
  }
}

interface Window {
  x: number
  y: number
  w: number
  h: number
}

function candidateWindows(): Window[] {
  return [
    { x: 0, y: 0, w: 3, h: 5 },
    { x: 5, y: 0, w: 3, h: 5 },
    { x: 0, y: 0, w: 3, h: 3 },
    { x: 5, y: 0, w: 3, h: 3 },
    { x: 0, y: 0, w: 4, h: 2 },
    { x: 4, y: 0, w: 4, h: 2 },
  ]
}

function windowScore(cells: Cell[], subject: boolean[], window: Window): number {
  const stats = windowStats(cells, window)
  const overlap = overlapFraction(subject, window)
  const short = window.h < 3 ? 0.35 : 0
  return stats.edge + overlap * 4 + short
}

function windowStats(cells: Cell[], window: Window): { edge: number; luma: number; r: number; g: number; b: number } {
  let edge = 0
  let luma = 0
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let y = window.y; y < window.y + window.h; y += 1) {
    for (let x = window.x; x < window.x + window.w; x += 1) {
      const cell = cells[y * COLS + x]
      if (!cell) continue
      edge += cell.edge
      luma += cell.luma
      r += cell.r
      g += cell.g
      b += cell.b
      count += 1
    }
  }
  const n = Math.max(1, count)
  return { edge: edge / n, luma: luma / n, r: r / n, g: g / n, b: b / n }
}

function overlapFraction(subject: boolean[], window: Window): number {
  let hit = 0
  let count = 0
  for (let y = window.y; y < window.y + window.h; y += 1) {
    for (let x = window.x; x < window.x + window.w; x += 1) {
      count += 1
      if (subject[y * COLS + x]) hit += 1
    }
  }
  return count === 0 ? 0 : hit / count
}

function subjectBox(marks: boolean[]): PhotoReading["subject"] {
  let minX = COLS
  let minY = ROWS
  let maxX = -1
  let maxY = -1
  marks.forEach((marked, index) => {
    if (!marked) return
    const x = index % COLS
    const y = Math.floor(index / COLS)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  })
  if (maxX < 0) return null
  return {
    x: minX / COLS,
    y: minY / ROWS,
    w: (maxX - minX + 1) / COLS,
    h: (maxY - minY + 1) / ROWS,
  }
}

function isStocky(cells: Cell[], subject: PhotoReading["subject"]): boolean {
  if (!subject) return false
  const centerX = subject.x + subject.w / 2
  const centerY = subject.y + subject.h / 2
  const centered = centerX > 0.38 && centerX < 0.62 && centerY > 0.3 && centerY < 0.7
  if (!centered) return false
  let quiet = 0
  let count = 0
  let symmetry = 0
  let pairs = 0
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS / 2; x += 1) {
      const left = cells[y * COLS + x]
      const right = cells[y * COLS + (COLS - 1 - x)]
      if (!left || !right) continue
      symmetry += Math.abs(left.luma - right.luma)
      pairs += 1
    }
  }
  for (const cell of cells) {
    quiet += cell.edge
    count += 1
  }
  const meanEdge = quiet / Math.max(1, count)
  const meanSymmetry = symmetry / Math.max(1, pairs)
  return meanEdge < 0.12 && meanSymmetry < 0.06
}

function sampleCells(rgba: ArrayLike<number>, width: number, height: number): Cell[] {
  const cells: Cell[] = []
  const cellW = width / COLS
  const cellH = height / ROWS
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      let edge = 0
      let skin = 0
      let luma = 0
      let r = 0
      let g = 0
      let b = 0
      let count = 0
      const x0 = Math.floor(col * cellW)
      const y0 = Math.floor(row * cellH)
      const x1 = Math.max(x0 + 1, Math.floor((col + 1) * cellW))
      const y1 = Math.max(y0 + 1, Math.floor((row + 1) * cellH))
      const stepX = Math.max(1, Math.floor((x1 - x0) / 6))
      const stepY = Math.max(1, Math.floor((y1 - y0) / 6))
      for (let y = y0; y < y1; y += stepY) {
        for (let x = x0; x < x1; x += stepX) {
          const here = pixel(rgba, width, height, x, y)
          const right = pixel(rgba, width, height, Math.min(width - 1, x + stepX), y)
          const down = pixel(rgba, width, height, x, Math.min(height - 1, y + stepY))
          const lHere = channelLuma(here)
          const gradient = Math.hypot(channelLuma(right) - lHere, channelLuma(down) - lHere) / 255
          edge += Math.min(1, gradient)
          if (isSkin(here)) skin += 1
          luma += lHere / 255
          r += here[0]
          g += here[1]
          b += here[2]
          count += 1
        }
      }
      const n = Math.max(1, count)
      cells.push({ edge: edge / n, skin: skin / n, luma: luma / n, r: r / n, g: g / n, b: b / n })
    }
  }
  return cells
}

function pixel(rgba: ArrayLike<number>, width: number, height: number, x: number, y: number): [number, number, number] {
  const index = (Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))) * 4
  return [rgba[index] ?? 0, rgba[index + 1] ?? 0, rgba[index + 2] ?? 0]
}

function channelLuma(rgb: [number, number, number]): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

function isSkin(rgb: [number, number, number]): boolean {
  const [r, g, b] = rgb
  return r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 15 && r - b > 15
}

function rgbHex(r: number, g: number, b: number): string {
  return `#${byte(r)}${byte(g)}${byte(b)}`
}

function byte(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")
}

function safeContrast(foreground: string, background: string): number {
  try {
    return contrastRatio(foreground, background)
  } catch {
    return 1
  }
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}
