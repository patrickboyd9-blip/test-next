import type { CommandCenterSnapshot } from "./types"

const newUserSnapshot: CommandCenterSnapshot = {
  state: "new",
  greetingName: "Jordan",
  businessName: "Jordan's Plumbing",
  summary:
    "Welcome to Modern Mail. Once you launch your first campaign, this is where you'll see how it's performing and what to do next.",
  confidence: null,
  mailStatus: null,
  metrics: [],
  recommendations: [],
  opportunities: [],
}

const activeUserSnapshot: CommandCenterSnapshot = {
  state: "active",
  greetingName: "Jordan",
  businessName: "Jordan's Plumbing",
  summary:
    "Your Spring Tune-Up campaign is in motion — 128 postcards delivered, 42 on the way, and 6 more scheduled this week. Overall, things are on track.",
  confidence: {
    level: "on_track",
    primaryMetricLabel: "Phone calls",
    headline: "On track to hit your call goal this month",
    evidence:
      "Spring Tune-Up has generated 37 calls from 128 delivered postcards — a 29% response rate, well above your typical campaign.",
  },
  mailStatus: {
    delivered: 128,
    inTransit: 42,
    scheduled: 6,
    nextDelivery: {
      date: "Thu, Aug 6",
      label: "6 postcards — Spring Tune-Up",
    },
  },
  metrics: [
    { id: "calls", label: "Phone calls", value: 37, changePercent: 18 },
    { id: "redemptions", label: "Coupon redemptions", value: 12, changePercent: 4 },
  ],
  recommendations: [
    {
      id: "follow-up",
      title: "Send a follow-up postcard to non-responders",
      why: "42 recipients from Spring Tune-Up haven't called in the 3 weeks since delivery — a second touch typically re-engages a meaningful share of them.",
      estimatedImpact: "+8–12 phone calls",
      ctaLabel: "Create follow-up campaign",
      ctaHref: "/app/campaigns/new?from=spring-tune-up-followup",
    },
  ],
  opportunities: [],
}

const powerUserSnapshot: CommandCenterSnapshot = {
  state: "power",
  greetingName: "Jordan",
  businessName: "Jordan's Plumbing",
  summary:
    "Across your 4 active campaigns, response rates are up 9% this month, but Water Heater Special is underperforming — it needs a look before its next batch goes out.",
  confidence: {
    level: "needs_attention",
    primaryMetricLabel: "Phone calls",
    headline: "Water Heater Special is pulling your confidence down",
    evidence:
      "Across your 4 campaigns, calls are up 9% this month — but Water Heater Special's call rate is 40% below the rest, and 80 more postcards go out Monday before you've made a change.",
  },
  mailStatus: {
    delivered: 512,
    inTransit: 96,
    scheduled: 140,
    nextDelivery: {
      date: "Mon, Aug 3",
      label: "80 postcards — Water Heater Special",
    },
  },
  metrics: [
    { id: "calls", label: "Phone calls", value: 164, changePercent: 9 },
    { id: "redemptions", label: "Coupon redemptions", value: 58, changePercent: 22 },
    { id: "bookings", label: "Booked appointments", value: 31, changePercent: -6 },
  ],
  recommendations: [
    {
      id: "underperforming",
      title: "Revise Water Heater Special before the next batch",
      why: "This campaign's call rate is 40% below your other active campaigns, and 80 more postcards are scheduled to go out Monday.",
      estimatedImpact: "Avoid ~80 underperforming sends",
      ctaLabel: "Review campaign",
      ctaHref: "/app/campaigns/water-heater-special",
    },
    {
      id: "winning-audience",
      title: "Expand the Spring Tune-Up audience",
      why: "Households matching your Spring Tune-Up profile are converting at 2x your account average, and you haven't mailed to 1,200 similar households nearby yet.",
      estimatedImpact: "+15–20 phone calls",
      ctaLabel: "Import similar audience",
      ctaHref: "/app/audience/import?like=spring-tune-up",
    },
  ],
  opportunities: [
    {
      id: "seasonal",
      title: "Plan your fall maintenance campaign now",
      description:
        "Businesses like yours typically launch fall tune-up campaigns in early September — starting audience prep now keeps you ahead of the seasonal rush.",
      ctaLabel: "Start planning",
      ctaHref: "/app/campaigns/new?template=fall-maintenance",
    },
    {
      id: "channel-mix",
      title: "Test a smaller postcard format",
      description:
        "Accounts with a similar mail mix have cut cost-per-response by adding a lower-cost postcard size to their rotation without hurting response rate.",
      ctaLabel: "Explore formats",
      ctaHref: "/app/templates?filter=postcard",
    },
  ],
}

export const mockCommandCenterSnapshots: Record<
  CommandCenterSnapshot["state"],
  CommandCenterSnapshot
> = {
  new: newUserSnapshot,
  active: activeUserSnapshot,
  power: powerUserSnapshot,
}
