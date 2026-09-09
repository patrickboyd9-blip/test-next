export interface MailerSection {
    title: string
    content: string
  }
  
  export interface GeneratedMailer {
    headline: string
   subheadline: string
  
    front: MailerSection
    back: MailerSection
  
    callToAction: string
    offer: string
  
    imageSuggestions: string[]
    layoutNotes: string[]
  
    complianceNotes: string[]
  
    reasoning: string[]
  }