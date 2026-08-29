import { Badge } from "@/components/ui/badge"

interface StrategyTagsProps {
  tags: string[]
  className?: string
}

export function StrategyTags({ tags, className }: StrategyTagsProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {tags.map((tag) => (
        <Badge key={tag} variant="outline" className="text-xs">
          {tag}
        </Badge>
      ))}
    </div>
  )
}
