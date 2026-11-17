"use client"

import { useEffect, useRef } from "react"

/**
 * Night-sky comet.
 * NEXT_PUBLIC_COMET_STYLE=classic restores the original streak.
 * Unset, or any other value, uses the long-exposure comet.
 * Revert by changing the right-hand side of this line to "classic".
 */
const COMET_STYLE: "classic" | "realistic" =
  process.env.NEXT_PUBLIC_COMET_STYLE === "classic" ? "classic" : "realistic"

const PASS_MS = 11000
const FIRST_PASS_MS = 700
const GAP_MIN_MS = 20000
const GAP_MAX_MS = 40000

type Point = { x: number; y: number }

function ease(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t))
}

function unit(x: number, y: number) {
  const m = Math.hypot(x, y) || 1
  return { x: x / m, y: y / m }
}

function quad(a: Point, b: Point, c: Point, t: number): Point {
  const u = 1 - t
  return {
    x: u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    y: u * u * a.y + 2 * u * t * b.y + t * t * c.y,
  }
}

function place(w: number, viewH: number, t: number, dive: boolean): Point {
  const u = clamp01(t)
  if (dive) {
    return quad(
      { x: -0.22 * w, y: viewH * 0.08 },
      { x: 0.3 * w, y: viewH * 0.06 },
      { x: 0.88 * w, y: viewH * 0.4 },
      u,
    )
  }
  const high = quad(
    { x: -0.3 * w, y: viewH * 0.078 },
    { x: 0.5 * w, y: viewH * 0.07 },
    { x: 1.22 * w, y: viewH * 0.084 },
    u,
  )
  if (u < 0.74) return high
  const k = (u - 0.74) / 0.26
  return { x: high.x, y: high.y + k * k * (viewH * 0.32 - high.y) }
}

function velocity(w: number, viewH: number, t: number, dive: boolean) {
  const p0 = place(w, viewH, t, dive)
  const p1 = place(w, viewH, Math.min(1, t + 0.015), dive)
  return unit(p1.x - p0.x, p1.y - p0.y)
}

function limbFade(y: number, viewH: number) {
  const start = viewH * 0.16
  const end = viewH * 0.4
  if (y <= start) return 1
  const k = Math.min(1, (y - start) / (end - start))
  return 1 - k * k * 0.92
}

function envelope(t: number) {
  return Math.min(1, t / 0.08) * Math.min(1, (1 - t) / 0.24)
}

function filament(seed: number, s: number) {
  return Math.sin(seed + s * 46) * 0.65 + Math.sin(seed * 1.9 + s * 19) * 0.35
}

function ribbon(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  perp: Point[],
  widthAt: (s: number) => number,
  stops: Array<[number, string]>,
) {
  if (points.length < 2) return
  ctx.beginPath()
  for (let i = 0; i < points.length; i++) {
    const s = i / (points.length - 1)
    const width = widthAt(s)
    const x = points[i].x + perp[i].x * width
    const y = points[i].y + perp[i].y * width
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  for (let i = points.length - 1; i >= 0; i--) {
    const s = i / (points.length - 1)
    const width = widthAt(s)
    ctx.lineTo(points[i].x - perp[i].x * width, points[i].y - perp[i].y * width)
  }
  ctx.closePath()
  const head = points[0]
  const tail = points[points.length - 1]
  const gradient = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y)
  for (const [offset, color] of stops) gradient.addColorStop(offset, color)
  ctx.fillStyle = gradient
  ctx.fill()
}

function paintComet(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  viewH: number,
  travel: number,
  strength: number,
  dive: boolean,
  seed: number,
) {
  const t = ease(clamp01(travel))
  const alpha = strength * envelope(travel)
  if (alpha <= 0.01 || w < 2 || h < 2) return
  const head = place(w, viewH, t, dive)
  const fade = alpha * limbFade(head.y, viewH)
  if (fade <= 0.01) return
  const scale = Math.min(1.05, Math.max(0.72, viewH / 900))
  const vel = velocity(w, viewH, t, dive)
  const back = { x: -vel.x, y: -vel.y }
  const side = { x: -vel.y, y: vel.x }

  const dust: Point[] = []
  const dustPerp: Point[] = []
  const steps = 42
  for (let i = 0; i <= steps; i++) {
    const s = i / steps
    const u = t - s * Math.min(0.62, t)
    if (u < 0) break
    const p = place(w, viewH, u, dive)
    const tangent = velocity(w, viewH, Math.max(0.001, u), dive)
    const normal = { x: -tangent.y, y: tangent.x }
    const drift = s * s * 10 * scale + filament(seed, s) * 2.4 * s * scale
    dust.push({ x: p.x + normal.x * drift, y: p.y + Math.abs(normal.y) * drift + s * s * 16 * scale })
    dustPerp.push(normal)
  }

  ctx.save()
  ctx.globalCompositeOperation = "lighter"

  ribbon(ctx, dust, dustPerp, (s) => (1.8 + s * s * 13) * scale, [
    [0, `rgba(255, 244, 226, ${0.78 * fade})`],
    [0.16, `rgba(255, 178, 120, ${0.46 * fade})`],
    [0.55, `rgba(214, 124, 70, ${0.16 * fade})`],
    [1, "rgba(170, 96, 58, 0)"],
  ])

  for (let i = 1; i < dust.length; i += 3) {
    const s = i / dust.length
    const radius = (8 + s * 18) * scale
    const glow = ctx.createRadialGradient(dust[i].x, dust[i].y, 0, dust[i].x, dust[i].y, radius)
    glow.addColorStop(0, `rgba(255, 214, 170, ${0.16 * (1 - s) * fade})`)
    glow.addColorStop(1, "rgba(255, 214, 170, 0)")
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(dust[i].x, dust[i].y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.lineCap = "round"
  for (const offset of [-0.7, 0.15, 0.85]) {
    ctx.beginPath()
    dust.forEach((p, i) => {
      const s = i / Math.max(1, dust.length - 1)
      const n = dustPerp[i]
      const x = p.x + n.x * offset * (2 + s * 7) * scale
      const y = p.y + n.y * offset * (2 + s * 7) * scale
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = `rgba(255, 228, 196, ${(0.07 + Math.abs(offset) * 0.04) * fade})`
    ctx.lineWidth = (0.6 + Math.abs(offset)) * scale
    ctx.stroke()
  }

  const ionLen = Math.min(w * 0.5, 560) * (0.55 + 0.45 * t)
  const ion: Point[] = []
  const ionPerp: Point[] = []
  for (let i = 0; i <= 28; i++) {
    const s = i / 28
    ion.push({
      x: head.x + back.x * ionLen * s - side.x * s * 6 * scale,
      y: head.y + back.y * ionLen * s - 18 * s * scale,
    })
    ionPerp.push(side)
  }
  ribbon(ctx, ion, ionPerp, (s) => (0.6 + s * 2.6) * scale, [
    [0, `rgba(236, 250, 255, ${0.9 * fade})`],
    [0.12, `rgba(120, 196, 255, ${0.62 * fade})`],
    [0.45, `rgba(70, 140, 255, ${0.28 * fade})`],
    [1, "rgba(40, 90, 220, 0)"],
  ])

  const blooms: Array<[number, string, string]> = [
    [20 * scale, `rgba(150, 220, 255, ${0.34 * fade})`, "rgba(150, 220, 255, 0)"],
    [8 * scale, `rgba(230, 252, 255, ${0.8 * fade})`, "rgba(230, 252, 255, 0)"],
    [2.4 * scale, `rgba(255, 255, 255, ${fade})`, "rgba(214, 250, 255, 0)"],
  ]
  for (const [radius, inner, outer] of blooms) {
    const glow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, radius)
    glow.addColorStop(0, inner)
    glow.addColorStop(1, outer)
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(head.x, head.y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function CometClassic({ arrival }: { arrival: boolean }) {
  return <div className={arrival ? "mm-comet mm-comet-arrive" : "mm-comet"} />
}

function CometRealistic({ arrival }: { arrival: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0
    let timer = 0
    let stopped = false
    const seed = 1.7 + Math.random() * 4

    function fit() {
      const rect = canvas!.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(1, Math.round(rect.width * dpr))
      const height = Math.max(1, Math.round(rect.height * dpr))
      if (canvas!.width !== width || canvas!.height !== height) {
        canvas!.width = width
        canvas!.height = height
      }
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      return rect
    }

    function draw(travel: number, strength: number) {
      const rect = fit()
      ctx!.clearRect(0, 0, rect.width, rect.height)
      paintComet(ctx!, rect.width, rect.height, window.innerHeight, travel, strength, arrival, seed)
      canvas!.dataset.pass = travel.toFixed(3)
    }

    if (reduced.matches) {
      draw(0.62, 0.28)
      return () => {
        stopped = true
      }
    }

    function pass() {
      const started = performance.now()
      const duration = arrival ? 8000 : PASS_MS
      const tick = (now: number) => {
        if (stopped) return
        if (document.hidden) {
          frame = requestAnimationFrame(tick)
          return
        }
        const travel = (now - started) / duration
        if (travel >= 1) {
          const rect = canvas!.getBoundingClientRect()
          ctx!.clearRect(0, 0, rect.width, rect.height)
          canvas!.dataset.pass = "0"
          if (!arrival) timer = window.setTimeout(pass, GAP_MIN_MS + Math.random() * (GAP_MAX_MS - GAP_MIN_MS))
          return
        }
        draw(travel, 1)
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }

    timer = window.setTimeout(pass, arrival ? 280 : FIRST_PASS_MS)
    const onResize = () => {
      if (reduced.matches) draw(0.62, 0.28)
    }
    window.addEventListener("resize", onResize)
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      window.removeEventListener("resize", onResize)
    }
  }, [arrival])
  return <canvas ref={ref} className="mm-comet-realistic" data-comet="realistic" aria-hidden />
}

export function SkyComet({ arrival }: { arrival: boolean }) {
  if (COMET_STYLE === "classic") return <CometClassic arrival={arrival} />
  return <CometRealistic arrival={arrival} />
}
