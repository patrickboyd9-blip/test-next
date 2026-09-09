import type { CampaignBrief } from "../campaign-creator/types"

import { CAMPAIGN_STRATEGY_PRINCIPLES } from "./principles"
import { DIRECT_MAIL_BEST_PRACTICES } from "./direct-mail-best-practices"
import { findIndustryPlaybook } from "./playbooks"
import { generateRecommendations } from "./recommendation-engine"

export function buildCampaignPrompt(
  brief: CampaignBrief
): string {
  const searchableText = JSON.stringify(brief)

const playbook = findIndustryPlaybook(searchableText)

const recommendationResult = generateRecommendations(brief)
const campaignEvaluation = recommendationResult.evaluation
const recommendationText =
  recommendationResult.recommendations.length > 0
    ? recommendationResult.recommendations
        .map(
          recommendation =>
            `• ${recommendation.title}: ${recommendation.explanation}`
        )
        .join("\n")
    : "No strategic recommendations."

  return `
${CAMPAIGN_STRATEGY_PRINCIPLES.join("\n")}
You are an elite direct-mail marketing strategist.

Before creating any campaign:

1. Review the Campaign Recommendations.
2. Use those recommendations to improve the campaign.
3. Apply the Industry Expertise whenever available.
4. Follow the Direct Mail Best Practices.
5. If information is missing, make reasonable assumptions and explain them.
6. Do not ignore recommendations simply because the campaign brief is incomplete.
7. Produce practical recommendations that maximize response rate and ROI.

${DIRECT_MAIL_BEST_PRACTICES}
Campaign Recommendations:

${recommendationText}

${
  playbook
    ? `Industry Expertise

${playbook}`
    : ""
}

Current Campaign Brief:

${JSON.stringify(brief, null, 2)}

Using everything above, create a complete direct-mail strategy.

Begin your response with a Campaign Assessment section.

Campaign Assessment:
- Overall Campaign Score (0–100)
- Confidence Level
- Top 3 Critical Issues
- Biggest Opportunity
- Biggest Risk

Then provide:

1. Executive Summary

2. Target Audience

3. Primary Offer

4. Mail Format Recommendation

5. Messaging Strategy

6. Call-to-Action

7. Campaign Timing

8. Success Metrics

9. Optimization Recommendations

10. Testing Recommendations

11. Expected Risks

12. Expected Strengths

For every recommendation:

- Explain WHY you made it.
- Reference campaign information whenever possible.
- Use direct-mail best practices.
- If assumptions are made, clearly state them.
- Prioritize recommendations that improve ROI.
`
}