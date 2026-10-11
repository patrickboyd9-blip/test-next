import { Button } from "@/components/ui/button"

const EXAMPLE_PROMPTS = [
  "I want to get more appointments from homeowners nearby.",
  "I want to send 1,000 postcards to this neighborhood.",
  "We're opening a restaurant and want to promote our grand opening.",
  "I want to send birthday cards to our employees.",
]

interface OpeningPromptProps {
  onSelectExample: (prompt: string) => void
  onHaveDesign: () => void
}

export function OpeningPrompt({ onSelectExample, onHaveDesign }: OpeningPromptProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <h1 className="text-xl font-semibold">What would you like to accomplish?</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Describe what you want in your own words — Modern Mail will ask what it needs
        to know next.
      </p>
      <button
        type="button"
        onClick={onHaveDesign}
        className="flex w-full max-w-md flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="text-sm font-medium text-foreground">I already have a design</span>
        <span className="text-sm leading-5 text-muted-foreground">
          Upload a front and a back. We&apos;ll check the print size, then you can approve the proof.
        </span>
      </button>
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
  )
}
