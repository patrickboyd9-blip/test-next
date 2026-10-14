import { isMedicareAgentBrief } from "./medicare-compliance"
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
  if (isMedicareAgentBrief(brief)) return medicareAgentDirections(brief)

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
        layoutVariant: "peer_split",
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
        leadJob: "trust",
        imageryRole: "crew",
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
        layoutVariant: "banded_split",
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
        leadJob: "urgency",
        imageryRole: "neighborhood",
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
        layoutVariant: "image_grounded",
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
        leadJob: "offer",
        imageryRole: "neighborhood",
      },
    },
  ]
}

function medicareAgentDirections(brief: CampaignBrief): CreativeDirection[] {
  const business = brief.businessInfo?.name ?? "Your local advisor"
  const offer = brief.offer?.trim() || "Free plan review"
  const phone = brief.phone ?? brief.businessInfo?.phone
  const website = brief.website ?? brief.businessInfo?.website
  const designedToDrive =
    brief.primarySuccessMetric?.description ?? "Plan review conversations"
  const contact = {
    ...(phone ? { phone } : {}),
    ...(website ? { website, qrDestination: brief.qrDestination ?? website } : {}),
  }

  return [
    {
      id: "dir-free-review",
      name: "Free Plan Review",
      recommended: true,
      designedToDrive,
      rationale:
        "Leads with a free plan review and a large way to respond, for someone who wants help before choosing a plan.",
      tags: ["Offer-led", "Local", "Clear"],
      createdAt: MOCK_CREATED_AT,
      spec: {
        layoutVariant: "peer_split",
        headline: "Free Plan Review",
        subheadline: `A local look from ${business}`,
        body: "Scan or call and we will walk through the plans we offer in your area.",
        callToAction: "Scan for a review",
        offer,
        ...contact,
        visualDirection:
          "An active, capable older couple walking a sunny residential sidewalk, contemporary color, healthy and independent, with quiet sky left open for type.",
        tone: "Calm, local, plain",
        palette: ["#1f3a4d", "#e7eef2", "#f6f3ee"],
        imagery: "stock_generic_local",
        leadJob: "offer",
        imageryRole: "neighborhood",
        layoutHints: { qrProminence: "large" },
      },
    },
    {
      id: "dir-capable-couple",
      name: "Capable Couple",
      recommended: false,
      designedToDrive,
      oneLineDifference: "The people in the picture lead, and the review stays a conversation.",
      rationale:
        "Puts an active older couple first so the piece feels human and local, then offers the same free review.",
      tags: ["Trust-led", "Human", "Calm"],
      createdAt: MOCK_CREATED_AT,
      spec: {
        layoutVariant: "image_grounded",
        headline: "Your Next Step",
        subheadline: "Talk with someone local",
        body: "You can sit down for a free plan review and ask what the plans we offer would mean for you.",
        callToAction: "Book a review",
        offer,
        ...contact,
        visualDirection:
          "An active, capable older couple talking at a sunny outdoor table, natural color, at ease, with calm space beside them for type.",
        tone: "Warm, capable, unhurried",
        palette: ["#3f4f3a", "#efe6d6", "#f7f4ee"],
        imagery: "stock_generic_local",
        leadJob: "trust",
        imageryRole: "crew",
        layoutHints: { qrProminence: "large" },
      },
    },
    {
      id: "dir-straight-talk",
      name: "Straight Talk",
      recommended: false,
      designedToDrive,
      oneLineDifference: "Big type and open space carry the explanation, with the photograph kept beside the words.",
      rationale:
        "Uses large type and open space so the review is easy to read at arm's length, with one large code beside the action.",
      tags: ["Plain speech", "Open", "Readable"],
      createdAt: MOCK_CREATED_AT,
      spec: {
        layoutVariant: "type_primary_split",
        headline: "Straight Talk Here",
        subheadline: "No rush and no fine print",
        body: "You get a plain explanation of the plans we offer, with room to read and one code to scan.",
        callToAction: "Start the review",
        offer,
        ...contact,
        visualDirection:
          "An active, capable older couple gardening together in daylight, standing and well, contemporary color, with open space around them.",
        tone: "Direct, calm, adult",
        palette: ["#243044", "#d9e2ec", "#f4f1ea"],
        imagery: "stock_generic_local",
        leadJob: "offer",
        imageryRole: "consequence",
        layoutHints: { qrProminence: "large" },
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
