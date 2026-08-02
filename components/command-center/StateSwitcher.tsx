import Link from "next/link"
import { cn } from "@/lib/utils"
import type { CommandCenterUserState } from "@/lib/command-center/types"

const STATES: { value: CommandCenterUserState; label: string }[] = [
  { value: "new", label: "New" },
  { value: "active", label: "Active" },
  { value: "power", label: "Power" },
]

export function StateSwitcher({ current }: { current: CommandCenterUserState }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-muted/50 p-1 text-xs">
      <span className="px-2 text-muted-foreground">Preview:</span>
      {STATES.map((s) => (
        <Link
          key={s.value}
          href={`/app?state=${s.value}`}
          className={cn(
            "rounded-full px-2.5 py-1 font-medium transition-colors",
            current === s.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {s.label}
        </Link>
      ))}
    </div>
  )
}
