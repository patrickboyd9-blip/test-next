import type { CampaignBrief } from "../campaign-creator/types"

import { CAMPAIGN_STRATEGY_PRINCIPLES } from "./principles"
import { DIRECT_MAIL_BEST_PRACTICES } from "./direct-mail-best-practices"
import { findIndustryPlaybook } from "./playbooks"

export function buildCampaignPrompt(
  brief: CampaignBrief
): string {
  const searchableText = JSON.stringify(brief)

  const playbook =
    findIndustryPlaybook(searchableText)

  return `
${CAMPAIGN_STRATEGY_PRINCIPLES.join("\n")}

${DIRECT_MAIL_BEST_PRACTICES}

${
  playbook
    ? `Industry Expertise

${playbook}`
    : ""
}

Current Campaign Brief:

${JSON.stringify(brief, null, 2)}
`
}