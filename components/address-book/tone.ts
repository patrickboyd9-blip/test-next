export interface BookTone {
  panel: string
  title: string
  muted: string
  body: string
  input: string
  button: string
  secondary: string
  quiet: string
  error: string
  selected: string
  idle: string
  row: string
}

export function bookTone(tone: "cockpit" | "paper"): BookTone {
  if (tone === "paper") {
    return {
      panel: "rounded-xl border bg-background p-4 text-foreground sm:p-6",
      title: "text-xl font-semibold",
      muted: "mb-1 block text-sm text-muted-foreground",
      body: "text-sm text-foreground",
      input: "mt-1 min-h-12 w-full rounded-lg border bg-background px-3 text-base text-foreground",
      button: "inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background disabled:opacity-40 sm:w-auto",
      secondary: "inline-flex min-h-12 w-full items-center justify-center rounded-lg border px-4 text-sm sm:w-auto",
      quiet: "min-h-12 px-2 text-sm underline",
      error: "mt-1 block text-sm text-amber-800",
      selected: "border-foreground bg-muted",
      idle: "border-border",
      row: "border-b py-3",
    }
  }
  return {
    panel: "rounded-2xl border border-[#1c3d52] bg-[#0c1424]/95 p-4 text-[#e7f2fb] sm:p-6",
    title: "text-2xl font-semibold text-[#e7f2fb]",
    muted: "mb-1 block text-sm text-[#8aa0b4]",
    body: "text-sm text-[#b7c9d8]",
    input: "mt-1 min-h-12 w-full rounded-xl border border-[#245068] bg-[#071018] px-3 text-base text-[#e7f2fb] outline-none placeholder:text-[#6e8498] focus:border-[#5ce1ff]",
    button: "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#5ce1ff] px-4 text-sm font-semibold text-[#041018] disabled:opacity-40 sm:w-auto",
    secondary: "inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[#245068] px-4 text-sm text-[#e7f2fb] sm:w-auto",
    quiet: "min-h-12 px-2 text-sm text-[#8ecfff]",
    error: "mt-1 block text-sm text-[#f0a202]",
    selected: "border-[#5ce1ff] bg-[#102433]",
    idle: "border-[#245068]",
    row: "border-b border-[#1c3d52] py-3",
  }
}
