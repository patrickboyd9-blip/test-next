import Link from "next/link"
import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"

export function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-8 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Mail className="size-6" />
      </span>
      <h2 className="text-xl font-semibold">Let&apos;s launch your first campaign</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Once you create and send your first mailing, this is where you&apos;ll track its
        progress and get recommendations to improve it.
      </p>
      <Button size="lg" nativeButton={false} render={<Link href="/app/campaigns/new" />}>
        Launch your first campaign
      </Button>
    </div>
  )
}
