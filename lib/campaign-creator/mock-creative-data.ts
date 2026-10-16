import { layoutPolicyForBrief } from "@/lib/reference-corpus/research-layout"
import { referenceVerticalsForBrief } from "@/lib/reference-corpus/select-reference-cards"

import { isMedicareAgentBrief } from "./medicare-compliance"
import type {
  CampaignBrief,
  CreativeDirection,
  CreativeRecommendation,
  LayoutVariant,
} from "./types"

const MOCK_CREATED_AT = "2026-01-01T00:00:00.000Z"

/** Default HVAC sample campaign — used when brief fields are empty. */
export function getMockCreativeDirections(
  brief: CampaignBrief = {}
): CreativeDirection[] {
  if (isMedicareAgentBrief(brief)) return medicareAgentDirections(brief)
  const verticals = referenceVerticalsForBrief(brief)
  if (verticals.includes("plumbing")) return plumbingDirections(brief)
  if (verticals.includes("roofing")) return roofingDirections(brief)

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

function researchLayouts(brief: CampaignBrief): LayoutVariant[] {
  const policy = layoutPolicyForBrief(brief)
  const preferred = policy.preferred
  const ordered = [preferred, ...policy.allowed.filter((layout) => layout !== preferred)]
  return [
    ordered[0] ?? "peer_split",
    ordered[1] ?? ordered[0] ?? "peer_split",
    ordered[2] ?? ordered[1] ?? ordered[0] ?? "type_primary_split",
  ]
}

function plumbingDirections(brief: CampaignBrief): CreativeDirection[] {
  const business = brief.businessInfo?.name ?? "Harbor Plumbing"
  const offer = brief.offer ?? "Free visit to find the leak"
  const phone = brief.phone ?? brief.businessInfo?.phone ?? "(619) 555-0194"
  const website = brief.website ?? brief.businessInfo?.website
  const layouts = researchLayouts(brief)
  const designedToDrive = brief.primarySuccessMetric?.description ?? "Service calls"
  const contact = {
    phone,
    ...(website ? { website, qrDestination: brief.qrDestination ?? website } : {}),
  }

  return [
    {
      id: "dir-keep-number",
      name: "Keep This Number",
      recommended: true,
      designedToDrive,
      rationale:
        "The card is meant to stay in the house until a pipe needs someone. The words lead, and the photograph sits beside them.",
      tags: ["Trust-led", "Local", "Plain"],
      createdAt: MOCK_CREATED_AT,
      spec: {
        layoutVariant: layouts[0],
        headline: "Keep This Number",
        subheadline: offer,
        body: `${business} is the number you keep for the day a drain or a heater needs a look.`,
        callToAction: "Call when you need us",
        offer,
        ...contact,
        visualDirection:
          "A calm kitchen sink in daylight, a single drop at the faucet, ordinary and specific, with open space beside the fixture for type.",
        tone: "Calm, local, useful",
        palette: ["#1f3a4d", "#d7e2ea", "#f4f1ea"],
        imagery: "stock_generic_local",
        leadJob: "trust",
        imageryRole: "neighborhood",
      },
    },
    {
      id: "dir-slow-leak",
      name: "Slow Leak First",
      recommended: false,
      oneLineDifference: "Shows the leak itself, before it becomes a repair.",
      designedToDrive,
      rationale:
        "One photograph of water where it should not be carries the reason to call. The offer stays a single line.",
      tags: ["Problem-led", "Clear", "Direct"],
      createdAt: MOCK_CREATED_AT,
      spec: {
        layoutVariant: layouts[1],
        headline: "A Slow Leak Costs",
        subheadline: offer,
        body: "You can see the drip now. Call and we will tell you what it is before it spreads.",
        callToAction: "Call about the leak",
        offer,
        ...contact,
        visualDirection:
          "Water beading under a kitchen sink in ordinary daylight, a towel nearby, illustrative and not a ruined room.",
        tone: "Direct, calm, specific",
        palette: ["#243044", "#c4552a", "#f6f3ee"],
        imagery: "stock_generic_local",
        leadJob: "problem",
        imageryRole: "consequence",
      },
    },
    {
      id: "dir-local-call",
      name: "Local When It Breaks",
      recommended: false,
      oneLineDifference: "A person doing the work, with one way to reach them.",
      designedToDrive,
      rationale:
        "A working plumber makes the trade obvious at a glance. The phone is the action, and nothing else competes with it.",
      tags: ["Crew-led", "Phone", "Simple"],
      createdAt: MOCK_CREATED_AT,
      spec: {
        layoutVariant: layouts[2],
        headline: "We Are Already Local",
        subheadline: offer,
        body: `When something under your house gives way, ${business} is the call, not a search.`,
        callToAction: "Call the local crew",
        offer,
        ...contact,
        visualDirection:
          "A plumber at a water heater in a normal garage, natural color, hands at the work, with room beside the figure for type.",
        tone: "Capable, local, unhurried",
        palette: ["#3f4f3a", "#efe6d6", "#f7f4ee"],
        imagery: "stock_generic_local",
        leadJob: "offer",
        imageryRole: "crew",
      },
    },
  ]
}

function roofingDirections(brief: CampaignBrief): CreativeDirection[] {
  const business = brief.businessInfo?.name ?? "North Roofing"
  const offer = brief.offer ?? "Free roof inspection"
  const phone = brief.phone ?? brief.businessInfo?.phone ?? "(619) 555-0148"
  const website = brief.website ?? brief.businessInfo?.website
  const layouts = researchLayouts(brief)
  const designedToDrive = brief.primarySuccessMetric?.description ?? "Inspection bookings"
  const contact = {
    phone,
    ...(website ? { website, qrDestination: brief.qrDestination ?? website } : {}),
  }

  return [
    {
      id: "dir-visible-leak",
      name: "The Visible Leak",
      recommended: true,
      designedToDrive,
      rationale:
        "The photograph and the headline share the card, so the cost of waiting is visible in one glance. One inspection is the only ask.",
      tags: ["Problem-led", "Photo", "Direct"],
      createdAt: MOCK_CREATED_AT,
      spec: {
        layoutVariant: layouts[0],
        headline: "See The Ceiling Stain",
        subheadline: offer,
        body: `A stain on the ceiling is the roof talking. ${business} will look before the next rain.`,
        callToAction: "Book the inspection",
        offer,
        ...contact,
        visualDirection:
          "A pale water stain on a living-room ceiling in daylight, a bucket just in frame, illustrative and not this house's documented damage, with quiet wall space for type.",
        tone: "Plain, urgent, local",
        palette: ["#1c1917", "#c4552a", "#f4f1ea"],
        imagery: "stock_generic_local",
        leadJob: "problem",
        imageryRole: "consequence",
      },
    },
    {
      id: "dir-before-storm",
      name: "Before The Rain",
      recommended: false,
      oneLineDifference: "The street of roofs leads, and the inspection stays easy.",
      designedToDrive,
      rationale:
        "A row of roofs makes the neighborhood the subject. The inspection is the single next step, without a stack of offers.",
      tags: ["Neighborhood", "Offer", "Calm"],
      createdAt: MOCK_CREATED_AT,
      spec: {
        layoutVariant: layouts[1],
        headline: "Before The Next Rain",
        subheadline: offer,
        body: "You can see the roofs on your street. Ask for a look while the weather is still quiet.",
        callToAction: "Ask for a look",
        offer,
        ...contact,
        visualDirection:
          "Rooflines along a residential street in late-afternoon light, one ladder at a quiet eave, specific and unhurried, with open sky for type.",
        tone: "Local, steady, clear",
        palette: ["#243044", "#d9e2ec", "#f4f1ea"],
        imagery: "stock_generic_local",
        leadJob: "offer",
        imageryRole: "neighborhood",
      },
    },
    {
      id: "dir-honest-look",
      name: "One Honest Look",
      recommended: false,
      oneLineDifference: "Big type states the inspection, with the work beside the words.",
      designedToDrive,
      rationale:
        "The words lead with the inspection, and a photograph of the work sits beside them. Nothing else is asked.",
      tags: ["Type-led", "Inspection", "Clear"],
      createdAt: MOCK_CREATED_AT,
      spec: {
        layoutVariant: layouts[2],
        headline: "One Look At The Roof",
        subheadline: offer,
        body: `${business} will walk the roof and tell you what is there. You decide what happens next.`,
        callToAction: "Schedule the look",
        offer,
        ...contact,
        visualDirection:
          "Hands setting underlayment at a roof edge in daylight, the street visible beyond, capable and ordinary, not a close-up of shingles.",
        tone: "Direct, capable, adult",
        palette: ["#3f4f3a", "#efe6d6", "#f7f4ee"],
        imagery: "stock_generic_local",
        leadJob: "trust",
        imageryRole: "crew",
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
