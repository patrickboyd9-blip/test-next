import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { SpaceSky } from "./sky"

export function CockpitFrame({
  children,
  className,
  hero = false,
  arrival = false,
  postbox,
  hour,
}: {
  children: ReactNode
  className?: string
  hero?: boolean
  arrival?: boolean
  postbox?: "home" | "start" | "arrive"
  hour?: number
}) {
  return (
    <div className={cn("relative min-h-svh overflow-hidden bg-[#05080f] text-[#e7f2fb]", className)}>
      <SpaceSky hero={hero} arrival={arrival} postbox={postbox} hour={hour} />
      <div className="relative pb-16">{children}</div>
    </div>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-[#7ee7ff]">{children}</p>
  )
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[#1c3d52] bg-[#0c1424]/95 shadow-[0_0_40px_rgba(8,16,28,0.45)] backdrop-blur-md",
        className
      )}
    >
      {children}
    </section>
  )
}

export function fieldClass() {
  return "min-h-12 w-full rounded-xl border border-[#245068] bg-[#071018] px-3 text-base text-[#e7f2fb] outline-none placeholder:text-[#6e8498] focus:border-[#5ce1ff]"
}
