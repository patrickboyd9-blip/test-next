import { PLUMBER_PLAYBOOK } from "./plumbers"

export interface IndustryPlaybook {
  keywords: string[]
  content: string
}

const PLAYBOOKS: IndustryPlaybook[] = [
  {
    keywords: [
      "plumber",
      "plumbing",
      "plumbing company",
      "plumbing contractor",
    ],
    content: PLUMBER_PLAYBOOK,
  },
]

export function findIndustryPlaybook(
  text: string
): string | null {
  const normalized = text.toLowerCase()

  const playbook = PLAYBOOKS.find((entry) =>
    entry.keywords.some((keyword) =>
      normalized.includes(keyword)
    )
  )

  return playbook?.content ?? null
}