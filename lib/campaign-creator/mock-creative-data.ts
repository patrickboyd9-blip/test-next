import type {
  CampaignBrief,
  CreativeDirection,
  CreativeRecommendation,
} from "./types"

const MOCK_CREATED_AT = "2026-01-01T00:00:00.000Z"

/** Default HVAC sample campaign — used when brief fields are empty. */
export function getMockCreativeDirections(
  brief: CampaignBrief = {}
): CreativeDirection[] {
  const business = brief.businessInfo?.name ?? "ABC Air Conditioning"
  const offer = brief.offer ?? "15% off your first service call"
  const phone = brief.phone ?? brief.businessInfo?.phone ?? "(949) 555-0142"
  const website = brief.website ?? brief.businessInfo?.website ?? "abcair.com/book"
  const designedToDrive =
    brief.primarySuccessMetric?.description ?? "Appointment bookings"

  const leadId = "dir-trusted-local"
  const boldId = "dir-bold-offer"
  const neighborId = "dir-neighborhood"

  return [
    {
      id: leadId,
      name: "Trusted Local Expert",
      recommended: true,
      designedToDrive,
      rationale:
        "Clean, professional layout that leads with your 15% off offer and puts the booking QR front and center. Best for homeowners who need confidence before calling a contractor they haven't used.",
      tags: ["Offer-led", "QR-forward", "Professional"],
      createdAt: MOCK_CREATED_AT,
      spec: {
        format: "postcard_4x6",
        layoutVariant: "trust_first",
        headline: `${business}`,
        subheadline: "Your neighbors trust us for fast, reliable HVAC service",
        body: `${offer}. Licensed, insured, and locally owned since 2008.`,
        callToAction: "Scan to book online",
        offer,
        phone,
        website,
        qrDestination: website,
        visualDirection: "Professional technician at work, warm and trustworthy",
        tone: brief.emotionalTone ?? "Trustworthy, professional, local",
        palette: ["#1e3a5f", "#4a90a4", "#f5f5f0"],
        imagery: "stock_hvac",
        backLayout: "standard_address",
      },
    },
    {
      id: boldId,
      name: "Bold Seasonal Offer",
      recommended: false,
      designedToDrive,
      oneLineDifference:
        "Leads with urgency and a time-limited offer — best if you want immediate response.",
      rationale:
        "High-contrast offer banner grabs attention in the mailbox. The QR code and phone number share equal weight for customers ready to act now.",
      tags: ["Urgency-led", "Offer-forward", "High contrast"],
      createdAt: MOCK_CREATED_AT,
      spec: {
        format: "postcard_4x6",
        layoutVariant: "urgency_banner",
        headline: "BEAT THE HEAT",
        subheadline: `${offer.toUpperCase()}`,
        body: `${business} — same-day appointments available. Scan or call today.`,
        callToAction: "Book now",
        offer,
        phone,
        website,
        qrDestination: website,
        visualDirection: "Bold seasonal urgency, strong offer hierarchy",
        tone: "Urgent, energetic, action-oriented",
        palette: ["#c0392b", "#1a1a2e", "#ffffff"],
        imagery: "stock_hvac",
        backLayout: "standard_address",
      },
    },
    {
      id: neighborId,
      name: "Neighborhood Welcome",
      recommended: false,
      designedToDrive,
      oneLineDifference:
        "Warm, neighborhood-focused tone — best if you want to feel like a trusted local business.",
      rationale:
        "Friendly, community-first messaging with softer visuals. The booking path is clear without feeling sales-heavy — ideal for first-time outreach.",
      tags: ["Community-led", "Warm tone", "Soft sell"],
      createdAt: MOCK_CREATED_AT,
      spec: {
        format: "postcard_4x6",
        layoutVariant: "photo_led",
        headline: "Keeping Irvine comfortable",
        subheadline: `From your neighbors at ${business}`,
        body: `${offer}. We're proud to serve your neighborhood — book your appointment in seconds.`,
        callToAction: "Scan to schedule",
        offer,
        phone,
        website,
        qrDestination: website,
        visualDirection: "Warm neighborhood photography, approachable and local",
        tone: "Warm, welcoming, community-focused",
        palette: ["#2d6a4f", "#95d5b2", "#fefae0"],
        imagery: "stock_hvac",
        backLayout: "standard_address",
      },
    },
  ]
}

export function getMockRecommendation(
  directions: CreativeDirection[]
): CreativeRecommendation {
  const lead = directions.find((d) => d.recommended) ?? directions[0]
  return {
    directionId: lead.id,
    headline: "★ Our recommendation",
    rationale: lead.rationale,
  }
}

export function getLeadDirection(directions: CreativeDirection[]): CreativeDirection {
  return directions.find((d) => d.recommended) ?? directions[0]
}
