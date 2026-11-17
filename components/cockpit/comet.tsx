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
  // Right-hand sky, clear of the top bar and the headline block.
  return quad(
    { x: 0.84 * w, y: 156 },
    { x: 0.96 * w, y: 136 },
    { x: 1.1 * w, y: 150 },
    u,
  )
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

function rotate(v: Point, degrees: number): Point {
  const a = (degrees * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }
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
  const away = { x: -vel.x, y: -vel.y }
  const dustDir = rotate(away, 6 + (seed % 3))
  const ionDir = rotate(away, -8)
  const dustLen = 128 * scale
  const ionLen = 168 * scale
  const dust: Point[] = []
  const dustPerp: Point[] = []
  const ion: Point[] = []
  const ionPerp: Point[] = []
  const dustSide = { x: -dustDir.y, y: dustDir.x }
  const ionSide = { x: -ionDir.y, y: ionDir.x }
  for (let i = 0; i <= 28; i++) {
    const s = i / 28
    dust.push({
      x: head.x + dustDir.x * dustLen * s + dustSide.x * dustLen * 0.08 * s * s,
      y: head.y + dustDir.y * dustLen * s + dustSide.y * dustLen * 0.08 * s * s,
    })
    dustPerp.push(dustSide)
    ion.push({
      x: head.x + ionDir.x * ionLen * s,
      y: head.y + ionDir.y * ionLen * s,
    })
    ionPerp.push(ionSide)
  }

  ctx.save()
  ctx.globalCompositeOperation = "screen"
  ctx.filter = `blur(${7 * scale}px)`
  ribbon(ctx, ion, ionPerp, (s) => (1.2 + s * ionLen * 0.045) * scale, [
    [0, `rgba(150, 190, 255, ${0.22 * fade})`],
    [0.35, `rgba(70, 120, 230, ${0.1 * fade})`],
    [1, "rgba(40, 80, 200, 0)"],
  ])
  ctx.filter = `blur(${9 * scale}px)`
  ribbon(ctx, dust, dustPerp, (s) => (2 + s * dustLen * 0.17) * scale, [
    [0, `rgba(255, 255, 255, ${0.95 * fade})`],
    [0.35, `rgba(236, 250, 255, ${0.72 * fade})`],
    [0.75, `rgba(210, 238, 255, ${0.38 * fade})`],
    [1, "rgba(190, 225, 255, 0)"],
  ])
  ctx.filter = "none"

  const blooms: Array<[number, string, string]> = [
    [22 * scale, `rgba(186, 226, 255, ${0.3 * fade})`, "rgba(186, 226, 255, 0)"],
    [9 * scale, `rgba(240, 252, 255, ${0.75 * fade})`, "rgba(210, 240, 255, 0)"],
    [3.2 * scale, `rgba(255, 255, 255, ${fade})`, "rgba(230, 248, 255, 0)"],
  ]
  for (const [radius, inner, outer] of blooms) {
    const glow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, radius)
    glow.addColorStop(0, inner)
    glow.addColorStop(0.2, inner)
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
