/**
 * Draft compliance copy for Modern Mail.
 *
 * This is the only file to edit when an attorney rewrites the words.
 * Bump `versionId` (and the document version that changed) in the same edit.
 * Acceptance is stored against these version ids and a SHA-256 of the text
 * actually shown. Either change makes the client agree again.
 *
 * DRAFT — pending attorney review. Not legal advice.
 * Product decision (Oct 22, 2026): Medicare is a warning, not a block.
 * Block only categories that are clearly nonmailable. No disclaimer fields
 * are inserted into the mailer.
 */

export const COMPLIANCE_TEXT_VERSION = "draft-2026-10-22"

export const COMPLIANCE_TEXT = {
  versionId: COMPLIANCE_TEXT_VERSION,
  draftNotice: "Draft — pending attorney review. Not legal advice.",
  account: {
    termsVersionId: "terms-draft-2026-10-22",
    aupVersionId: "aup-draft-2026-10-22",
    privacyVersionId: "privacy-draft-2026-10-22",
    checkbox:
      "I agree to the Modern Mail Terms of Service, Acceptable Use Policy, and Privacy Policy. I understand that I am responsible for my mailers and mailing lists, and that Modern Mail does not provide legal advice.",
    notice:
      "Modern Mail is a design, printing, and mailing service. We are not a law firm. Our AI tools can make mistakes and may suggest wording that is inaccurate or not allowed for your industry or state. You must review and approve every mailer before it is sent.",
    documents: {
      terms: {
        title: "Terms of Service",
        href: "/legal/terms",
        body: "Placeholder. Modern Mail has not published final Terms of Service. Until an attorney replaces this page, the account checkbox is the agreement we ask you to accept: you are responsible for your mailers and mailing lists, and Modern Mail does not provide legal advice. Modern Mail is a design, printing, and mailing service. It is not a law firm, and it does not review a mailer for legal compliance.",
      },
      aup: {
        title: "Acceptable Use Policy",
        href: "/legal/aup",
        body: "Placeholder. Modern Mail has not published a final Acceptable Use Policy. You may not use Modern Mail to send cannabis or THC advertising, lottery advertising, sexually oriented advertising, weapons advertising, or a piece designed to look like a government notice, a bill, or a check. You may not mail a list you do not have the right to use. You must honor a recipient who asks not to be mailed.",
      },
      privacy: {
        title: "Privacy Policy",
        href: "/legal/privacy",
        body: "Placeholder. Modern Mail has not published a final Privacy Policy. We store the agreement you accept, the campaign it applies to, and a copy of the proof you approved so we can show what was agreed and when. We do not sell that acceptance record.",
      },
    },
  },
  campaign: {
    versionId: "campaign-cert-draft-2026-10-22",
    prompt: "What is this mailer advertising?",
    boxes: {
      reviewedProof:
        "I have reviewed this final proof, including all text and images created by AI, and I approve it as my own advertising.",
      responsibility:
        "I am responsible for making sure this mailer, my offer, and my mailing list follow all laws and rules that apply to my business and the places I'm mailing, including federal, state, and industry rules. Modern Mail has not reviewed this mailer for legal compliance.",
      listRights:
        "I have the right to use this mailing list for this mailing, and I will honor requests from recipients who ask not to be mailed.",
    },
  },
} as const

export type IndustryAction = "allow" | "warn" | "block"

export interface IndustryCategory {
  id: string
  label: string
  action: IndustryAction
  /** Plain sentence shown when this category is chosen. Empty for allow. */
  warning: string
  /** Extra checkbox. Present only when action is warn. */
  acknowledgment: string
}

const WARN = {
  real_estate:
    "Real estate advertising has extra rules, including fair housing. I am responsible for following them. Modern Mail has not reviewed this mailer for those rules.",
  we_buy_houses:
    "“We buy houses” and wholesaling ads can have extra state rules. I am responsible for following them. Modern Mail has not reviewed this mailer for those rules.",
  mortgage_credit:
    "Mortgage, loan, and credit advertising has extra lending rules. I am responsible for following them. Modern Mail has not reviewed this mailer for those rules.",
  insurance:
    "Insurance advertising has extra rules, including any approval my carrier requires. I am responsible for following them. Modern Mail has not reviewed this mailer for those rules.",
  medicare:
    "Medicare plan advertising has extra federal rules. Modern Mail has not reviewed this mailer for Medicare compliance, and I am responsible for following those rules.",
  healthcare:
    "Healthcare advertising has extra rules, and this list does not include patient information. I am responsible for following those rules. Modern Mail has not reviewed this mailer for them.",
  alcohol:
    "Alcohol advertising has extra rules, including keeping it away from anyone under 21. I am responsible for following them. Modern Mail has not reviewed this mailer for those rules.",
  solar:
    "Solar and home-energy claims, including tax credits, “free,” or a government program, are my responsibility. Modern Mail has not reviewed this mailer for those rules.",
  sweepstakes:
    "Sweepstakes and contest advertising has extra rules. I am responsible for the official rules and the required disclosures. Modern Mail has not reviewed this mailer for those rules.",
  political:
    "Political and nonprofit mail has extra rules, including who paid for the piece. I am responsible for following them. Modern Mail has not reviewed this mailer for those rules.",
} as const

function warn(id: string, label: string, acknowledgment: string): IndustryCategory {
  return { id, label, action: "warn", warning: acknowledgment, acknowledgment }
}

function block(id: string, label: string, warning: string): IndustryCategory {
  return { id, label, action: "block", warning, acknowledgment: "" }
}

function allow(id: string, label: string): IndustryCategory {
  return { id, label, action: "allow", warning: "", acknowledgment: "" }
}

/**
 * Dropdown order is the order shown. The first screen state is empty —
 * nothing in this list is preselected.
 */
export const INDUSTRY_CATEGORIES: readonly IndustryCategory[] = [
  allow("general", "General"),
  warn("real_estate", "Real estate agent or broker", WARN.real_estate),
  warn("we_buy_houses", "“We buy houses” or wholesaling", WARN.we_buy_houses),
  warn("mortgage_credit", "Mortgage, loans, or credit", WARN.mortgage_credit),
  warn("insurance", "Insurance (not Medicare)", WARN.insurance),
  warn("medicare", "Medicare plans", WARN.medicare),
  warn("healthcare", "Healthcare provider", WARN.healthcare),
  warn("alcohol", "Alcohol", WARN.alcohol),
  block("cannabis", "Cannabis or THC", "Modern Mail can't mail cannabis or THC advertising."),
  warn("solar", "Solar or home energy", WARN.solar),
  warn("sweepstakes", "Sweepstakes or contest", WARN.sweepstakes),
  warn("political", "Political or nonprofit", WARN.political),
  block("lottery", "Lottery", "Modern Mail can't mail lottery advertising."),
  block(
    "sexually_oriented",
    "Sexually oriented",
    "Modern Mail can't mail sexually oriented advertising."
  ),
  block("weapons", "Weapons", "Modern Mail can't mail weapons advertising."),
  block(
    "government_lookalike",
    "Looks like a government notice or a bill",
    "Modern Mail can't mail a piece that looks like a government notice, a bill, or a check."
  ),
  allow("other", "Other"),
]

export interface CertificationBoxes {
  reviewedProof: boolean
  responsibility: boolean
  listRights: boolean
  industryAcknowledgment: boolean
}

export const EMPTY_CERTIFICATION_BOXES: CertificationBoxes = {
  reviewedProof: false,
  responsibility: false,
  listRights: false,
  industryAcknowledgment: false,
}

export interface TextVersionIds {
  pack: string
  terms: string
  aup: string
  privacy: string
  campaign: string
}

export function textVersionIds(): TextVersionIds {
  return {
    pack: COMPLIANCE_TEXT.versionId,
    terms: COMPLIANCE_TEXT.account.termsVersionId,
    aup: COMPLIANCE_TEXT.account.aupVersionId,
    privacy: COMPLIANCE_TEXT.account.privacyVersionId,
    campaign: COMPLIANCE_TEXT.campaign.versionId,
  }
}

export function industryById(id: string): IndustryCategory | undefined {
  return INDUSTRY_CATEGORIES.find((category) => category.id === id)
}

/** The account sentence, with the three document titles where the links sit. */
export function accountCheckboxParts(): {
  beforeTerms: string
  betweenTermsAndAup: string
  betweenAupAndPrivacy: string
  afterPrivacy: string
} {
  const sentence = COMPLIANCE_TEXT.account.checkbox
  const terms = COMPLIANCE_TEXT.account.documents.terms.title
  const aup = COMPLIANCE_TEXT.account.documents.aup.title
  const privacy = COMPLIANCE_TEXT.account.documents.privacy.title
  const termsAt = sentence.indexOf(terms)
  const aupAt = sentence.indexOf(aup)
  const privacyAt = sentence.indexOf(privacy)
  if (termsAt < 0 || aupAt < 0 || privacyAt < 0) {
    throw new Error("Account checkbox text is missing a document title.")
  }
  return {
    beforeTerms: sentence.slice(0, termsAt),
    betweenTermsAndAup: sentence.slice(termsAt + terms.length, aupAt),
    betweenAupAndPrivacy: sentence.slice(aupAt + aup.length, privacyAt),
    afterPrivacy: sentence.slice(privacyAt + privacy.length),
  }
}

export function accountPlainText(): string {
  const docs = COMPLIANCE_TEXT.account.documents
  return [
    COMPLIANCE_TEXT.draftNotice,
    COMPLIANCE_TEXT.account.checkbox,
    COMPLIANCE_TEXT.account.notice,
    `${docs.terms.title}\n${docs.terms.body}`,
    `${docs.aup.title}\n${docs.aup.body}`,
    `${docs.privacy.title}\n${docs.privacy.body}`,
  ].join("\n\n")
}

/** Exact campaign text shown for one industry, in display order. */
export function campaignPlainText(industryId: string): string {
  const industry = industryById(industryId)
  const lines = [
    COMPLIANCE_TEXT.draftNotice,
    COMPLIANCE_TEXT.campaign.prompt,
    industry?.label ?? "",
    industry?.warning ?? "",
    COMPLIANCE_TEXT.campaign.boxes.reviewedProof,
    COMPLIANCE_TEXT.campaign.boxes.responsibility,
    COMPLIANCE_TEXT.campaign.boxes.listRights,
  ]
  if (industry?.action === "warn") lines.push(industry.acknowledgment)
  return lines.filter((line) => line.length > 0).join("\n")
}

export function approveAndSendLabel(pieceCount: number, amountLabel: string): string {
  if (pieceCount <= 0 || !amountLabel || amountLabel === "—") return "Approve and send"
  const noun = pieceCount === 1 ? "postcard" : "postcards"
  return `Approve and send ${pieceCount} ${noun} for ${amountLabel}`
}

export interface CheckedBox {
  id: string
  text: string
}

/** Boxes that are on, in the order they appear. */
export function checkedBoxTexts(industry: IndustryCategory, boxes: CertificationBoxes): CheckedBox[] {
  const campaign = COMPLIANCE_TEXT.campaign.boxes
  const checked: CheckedBox[] = []
  if (boxes.reviewedProof) checked.push({ id: "reviewedProof", text: campaign.reviewedProof })
  if (boxes.responsibility) checked.push({ id: "responsibility", text: campaign.responsibility })
  if (boxes.listRights) checked.push({ id: "listRights", text: campaign.listRights })
  if (industry.action === "warn" && boxes.industryAcknowledgment) {
    checked.push({ id: "industryAcknowledgment", text: industry.acknowledgment })
  }
  return checked
}

/**
 * What is still missing on a fresh certification.
 * Null when the industry is allowed or warned and every required box is checked.
 */
export function freshCertificationIssue(
  industryId: string,
  boxes: CertificationBoxes
): { code: "industry_required" | "blocked" | "boxes"; message: string } | null {
  const industry = industryById(industryId)
  if (!industry) {
    return { code: "industry_required", message: "Choose what this mailer is advertising." }
  }
  if (industry.action === "block") {
    return { code: "blocked", message: industry.warning }
  }
  const missingProof = !boxes.reviewedProof || !boxes.responsibility || !boxes.listRights
  const missingAck = industry.action === "warn" && !boxes.industryAcknowledgment
  if (missingProof || missingAck) {
    return { code: "boxes", message: "Check each box before this can be sent." }
  }
  return null
}
