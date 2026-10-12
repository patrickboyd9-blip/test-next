import { ChevronLeft } from "lucide-react"

import { Button } from "@/components/ui/button"

const EXAMPLE_PROMPTS = [
  "I want to get more appointments from homeowners nearby.",
  "I want to send 1,000 postcards to this neighborhood.",
  "We're opening a restaurant and want to promote our grand opening.",
  "I want to send birthday cards to our employees.",
]

interface OpeningPromptProps {
  onSelectExample: (prompt: string) => void
  onBack: () => void
}

export function OpeningPrompt({ onSelectExample, onBack }: OpeningPromptProps) {
  return (
    <div className="flex flex-col gap-6 py-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1 rounded-md py-1 pr-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Back
      </button>
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-xl font-semibold">What would you like to accomplish?</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Describe what you want in your own words — Modern Mail will ask what it needs
          to know next.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <Button
              key={prompt}
              variant="outline"
              size="sm"
              onClick={() => onSelectExample(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
