import { ASSISTANT_NAME } from "@/lib/assistant/comet"

/** Small comet mark. The name lives in the assistant config. */
export function CometMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M4 20C12 18 18 16 28 12" fill="none" stroke="#7ee7ff" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
      <circle cx="28" cy="12" r="1.6" fill="#f4fdff" />
    </svg>
  )
}

export function CometName() {
  return <span className="font-medium">{ASSISTANT_NAME}</span>
}
