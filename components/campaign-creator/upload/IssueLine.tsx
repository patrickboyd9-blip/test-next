import type { UploadedDesignIssue } from "@/lib/campaign-creator/types"

export function IssueLine({ issue }: { issue: UploadedDesignIssue }) {
  const side = issue.face === "front" ? "Front" : "Back"
  return (
    <p className={issue.severity === "error" ? "text-sm leading-6 text-destructive" : "text-sm leading-6"}>
      <span className="font-medium">{side}. </span>
      {issue.message}
    </p>
  )
}
