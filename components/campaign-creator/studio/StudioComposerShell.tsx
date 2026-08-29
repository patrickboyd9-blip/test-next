import { Textarea } from "@/components/ui/textarea"

interface StudioComposerShellProps {
  disabled?: boolean
  placeholder?: string
  label?: string
}

export function StudioComposerShell({
  disabled = true,
  placeholder = "You'll refine your favorite here once concepts are ready.",
  label,
}: StudioComposerShellProps) {
  return (
    <div
      className={
        "flex flex-col gap-2 rounded-xl border border-input bg-card p-3 " +
        (disabled ? "pointer-events-none opacity-50" : "")
      }
    >
      {label && <span className="text-sm font-medium">{label}</span>}
      <Textarea
        disabled={disabled}
        placeholder={placeholder}
        className="min-h-10 resize-none border-0 bg-transparent shadow-none"
        rows={1}
        readOnly
      />
    </div>
  )
}
