"use client"

import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import type { CreativeSpec } from "@/lib/campaign-creator/types"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

import { ShimmerOverlay, SpecDiffHighlight } from "./SpecDiffHighlight"

export type PostcardPreviewSize = "hero" | "medium" | "thumbnail"

interface PostcardPreviewProps {
  spec: CreativeSpec
  side?: "front" | "back"
  size?: PostcardPreviewSize
  className?: string
  enableHoverTilt?: boolean
  highlightRegions?: string[]
  isShimmering?: boolean
  ariaLabel?: string
}

const SIZE_CLASSES: Record<PostcardPreviewSize, string> = {
  hero: "w-full max-w-[320px] sm:max-w-[360px] md:max-w-[420px]",
  medium: "w-full max-w-[280px]",
  thumbnail: "w-full h-full min-h-[100px]",
}

export function PostcardPreview({
  spec,
  side = "front",
  size = "hero",
  className,
  enableHoverTilt = true,
  highlightRegions = [],
  isShimmering = false,
  ariaLabel,
}: PostcardPreviewProps) {
  const reducedMotion = useReducedMotion()
  const [primary, secondary, accent] = spec.palette ?? ["#1e3a5f", "#4a90a4", "#f5f5f0"]
  const layout = spec.layoutVariant ?? "trust_first"

  const content =
    side === "back" ? (
      <PostcardBack primary={primary} />
    ) : (
      <PostcardFront
        spec={spec}
        primary={primary}
        secondary={secondary}
        accent={accent}
        layout={layout}
      />
    )

  const hoverProps =
    enableHoverTilt && !reducedMotion
      ? {
          whileHover: {
            rotateY: 2,
            scale: 1.01,
            transition: { duration: 0.2, ease: "easeOut" as const },
          },
          style: { transformPerspective: 800 },
        }
      : {}

  return (
    <motion.div
      className={cn(
        "relative aspect-[3/2] overflow-hidden rounded-lg shadow-lg sm:shadow-lg",
        SIZE_CLASSES[size],
        size === "thumbnail" && "shadow-md",
        className
      )}
      role="img"
      aria-label={ariaLabel ?? `Postcard preview: ${spec.headline ?? "Creative design"}`}
      {...hoverProps}
    >
      {content}
      {side === "front" && (
        <>
          <ShimmerOverlay active={isShimmering} />
          <SpecDiffHighlight regions={highlightRegions} active={highlightRegions.length > 0} />
        </>
      )}
    </motion.div>
  )
}

function PostcardFront({
  spec,
  primary,
  secondary,
  accent,
  layout,
}: {
  spec: CreativeSpec
  primary: string
  secondary: string
  accent: string
  layout: string
}) {
  const headlineScale = spec.layoutHints?.headlineScale ?? 1
  const phoneBottomRight = spec.layoutHints?.phonePosition === "bottom-right"
  const qrLarge = spec.layoutHints?.qrProminence === "large"

  if (layout === "urgency_banner") {
    return (
      <div className="flex h-full flex-col" style={{ backgroundColor: accent }}>
        <div
          className="px-3 py-2 text-center font-bold tracking-wider text-white sm:text-xs"
          style={{
            backgroundColor: primary,
            fontSize: `${Math.min(12 * headlineScale, 16)}px`,
          }}
        >
          {spec.headline}
        </div>
        <div
          className="flex flex-1 flex-col justify-between p-3 sm:p-4"
          style={{ backgroundColor: secondary }}
        >
          <p className="text-sm font-bold leading-tight text-white sm:text-base">{spec.subheadline}</p>
          <p className="text-[10px] leading-snug text-white/90 sm:text-xs">{spec.body}</p>
          <PostcardFooter spec={spec} accent={accent} dark phoneBottomRight={phoneBottomRight} />
        </div>
      </div>
    )
  }

  if (layout === "photo_led") {
    return (
      <div className="flex h-full flex-col" style={{ backgroundColor: accent }}>
        <div
          className="flex h-[45%] items-center justify-center text-[10px] font-medium text-white/80 sm:text-xs"
          style={{ backgroundColor: secondary }}
        >
          {spec.visualDirection}
        </div>
        <div
          className="flex flex-1 flex-col justify-between p-3 sm:p-4"
          style={{ backgroundColor: primary }}
        >
          <div>
            <p
              className="font-semibold text-white"
              style={{ fontSize: `${Math.min(14 * headlineScale, 18)}px` }}
            >
              {spec.headline}
            </p>
            <p className="mt-1 text-[10px] text-white/85 sm:text-xs">{spec.subheadline}</p>
          </div>
          <p className="text-[10px] leading-snug text-white/80 sm:text-xs">{spec.body}</p>
          <PostcardFooter spec={spec} accent={accent} dark phoneBottomRight={phoneBottomRight} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-3 sm:p-4" style={{ backgroundColor: accent }}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p
            className="font-bold"
            style={{ color: primary, fontSize: `${Math.min(14 * headlineScale, 20)}px` }}
          >
            {spec.headline}
          </p>
          <p className="mt-0.5 text-[10px] sm:text-xs" style={{ color: secondary }}>
            {spec.subheadline}
          </p>
        </div>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded font-bold text-white",
            qrLarge ? "size-11 text-[11px] sm:size-14 sm:text-sm" : "size-8 text-[8px] sm:size-10 sm:text-[10px]"
          )}
          style={{ backgroundColor: primary }}
        >
          QR
        </div>
      </div>
      <p className="flex-1 text-[10px] leading-relaxed sm:text-xs" style={{ color: primary }}>
        {spec.body}
      </p>
      <div
        className="mt-2 rounded px-2 py-1 text-center text-[10px] font-semibold sm:text-xs"
        style={{ backgroundColor: primary, color: accent }}
      >
        {spec.callToAction}
      </div>
      <PostcardFooter
        spec={spec}
        accent={primary}
        phoneBottomRight={phoneBottomRight}
      />
    </div>
  )
}

function PostcardFooter({
  spec,
  accent,
  dark = false,
  phoneBottomRight = false,
}: {
  spec: CreativeSpec
  accent: string
  dark?: boolean
  phoneBottomRight?: boolean
}) {
  if (phoneBottomRight) {
    return (
      <div
        className={cn(
          "relative mt-2 min-h-[28px] text-[9px] sm:text-[10px]",
          dark ? "text-white/70" : "opacity-70"
        )}
        style={dark ? undefined : { color: accent }}
      >
        <span className="absolute bottom-0 right-0">{spec.phone}</span>
        <span className="truncate max-w-[50%]">{spec.website}</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "mt-2 flex items-center justify-between text-[9px] sm:text-[10px]",
        dark ? "text-white/70" : "opacity-70"
      )}
      style={dark ? undefined : { color: accent }}
    >
      <span>{spec.phone}</span>
      <span className="truncate max-w-[50%]">{spec.website}</span>
    </div>
  )
}

function PostcardBack({ primary }: { primary: string }) {
  return (
    <div className="flex h-full flex-col bg-[#f8f8f8] p-3 sm:p-4">
      <div className="mb-auto space-y-1">
        <div className="h-2 w-24 rounded bg-neutral-300" />
        <div className="h-2 w-32 rounded bg-neutral-200" />
        <div className="h-2 w-28 rounded bg-neutral-200" />
      </div>
      <div className="space-y-2">
        <div className="h-12 w-full rounded border border-dashed border-neutral-300 bg-white" />
        <p className="text-[8px] text-neutral-400 sm:text-[9px]">POSTAGE INDICIA · Address panel</p>
      </div>
      <div className="mt-2 h-1 w-full rounded" style={{ backgroundColor: primary, opacity: 0.3 }} />
    </div>
  )
}

interface PostcardSideToggleProps {
  side: "front" | "back"
  onSideChange: (side: "front" | "back") => void
}

export function PostcardSideToggle({ side, onSideChange }: PostcardSideToggleProps) {
  return (
    <div
      className="inline-flex rounded-lg border border-border p-0.5"
      role="tablist"
      aria-label="Postcard side"
    >
      {(["front", "back"] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={side === value}
          onClick={() => onSideChange(value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
            side === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {value}
        </button>
      ))}
    </div>
  )
}
