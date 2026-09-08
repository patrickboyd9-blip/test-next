import type { CampaignRule } from "./rule"

export const missingSuccessMetricRule: CampaignRule = {
  id: "missing-success-metric",

  description: "Detects campaigns without a success metric.",

  evaluate(brief) {
    if (brief.primarySuccessMetric) {
      return null
    }

    return {
      category: "Measurement",
      severity: "warning",
      title: "Success metric missing",
      explanation:
        "Without a success metric it's difficult to measure campaign performance.",
      recommendation:
        "Choose one measurable outcome such as phone calls, appointments, purchases, or QR scans.",
    }
  },
}