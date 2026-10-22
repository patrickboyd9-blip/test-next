export function LegalDocument({
  title,
  versionId,
  body,
}: {
  title: string
  versionId: string
  body: string
}) {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">Version {versionId}</p>
      <p className="text-sm leading-7">{body}</p>
    </>
  )
}
