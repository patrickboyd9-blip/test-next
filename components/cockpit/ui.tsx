import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function CockpitFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative min-h-svh overflow-hidden bg-[#05080f] text-[#e7f2fb]", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{ backgroundImage: "linear-gradient(to bottom, rgba(92,225,255,0.08), transparent)" }}
      />
      <div className="relative">{children}</div>
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
        "rounded-2xl border border-[#1c3d52] bg-[#0c1424]/90 shadow-[0_0_40px_rgba(92,225,255,0.05)]",
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
