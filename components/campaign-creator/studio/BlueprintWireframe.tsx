import type { BlueprintBrowseCard } from "@/lib/campaign-creator/actions"

/**
 * An abstract drawing of a blueprint. It is not the source mailer.
 */
export function BlueprintWireframe({ boxes }: { boxes: BlueprintBrowseCard["boxes"] }) {
  return (
    <svg viewBox="0 0 160 100" className="aspect-[8/5] w-full rounded-md bg-muted" role="img" aria-label="Blueprint wireframe">
      <rect x="0" y="0" width="160" height="100" fill="none" />
      {boxes.map((box) => (
        <g key={`${box.role}-${box.x}-${box.y}`}>
          <rect
            x={box.x * 160}
            y={box.y * 100}
            width={Math.max(4, box.w * 160)}
            height={Math.max(4, box.h * 100)}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="1"
            className="text-foreground/50"
          />
          <text
            x={box.x * 160 + 3}
            y={box.y * 100 + 8}
            fontSize="6"
            className="fill-foreground/70"
          >
            {box.role}
          </text>
        </g>
      ))}
    </svg>
  )
}
