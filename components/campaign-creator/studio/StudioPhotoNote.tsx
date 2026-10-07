export function StudioPhotoNote({ note }: { note: string | null | undefined }) {
  if (!note) return null
  return (
    <p className="max-w-sm text-center text-xs text-muted-foreground" role="status">
      {note}
    </p>
  )
}
