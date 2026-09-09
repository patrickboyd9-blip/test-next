import { PLUMBER_PLAYBOOK } from "./plumbers"

export const PLAYBOOKS = {
  plumbing: PLUMBER_PLAYBOOK,
}

export function findIndustryPlaybook(text: string) {
  const lower = text.toLowerCase()

  if (
    lower.includes("plumb") ||
    lower.includes("drain") ||
    lower.includes("water heater") ||
    lower.includes("pipe")
  ) {
    return PLAYBOOKS.plumbing
  }

  return null
}