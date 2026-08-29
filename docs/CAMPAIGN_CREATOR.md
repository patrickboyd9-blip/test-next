# Campaign Creator

## Purpose

Campaign Creator is the primary entry point for creating a physical outreach campaign in Modern Mail.

Its purpose is to turn a customer's idea into a launchable campaign with as little friction as possible.

The customer should be able to describe what they want in their own words.

Modern Mail should understand the intent, ask only the questions it needs to ask, build the campaign configuration, and ultimately produce creative concepts the customer can review and refine.

Campaign Creator should feel less like completing a marketing form and more like working with a knowledgeable marketing strategist.

---

## Core Interaction Model

Campaign creation should be conversational and progressive.

The customer begins by describing what they want to accomplish in their own words.

Modern Mail then determines what it needs to know next.

The customer's previous answer should influence the next question.

Modern Mail should never ask for information it already knows and should not ask questions that are not necessary for the campaign.

The interaction continues until Modern Mail has enough information to confidently create the campaign and generate meaningful creative concepts.

The customer should be able to correct, clarify, or change their direction at any point without restarting the campaign.

The experience should feel like a conversation with a knowledgeable marketing strategist—not a multi-page form or configuration wizard.

---

## Campaign Understanding

Before generating creative concepts, Modern Mail should understand the essential elements of the campaign.

The required understanding is:

### 1. Campaign Goal

What does the customer ultimately want to accomplish?

Examples:

- Generate more HVAC appointments
- Drive customers into a new restaurant
- Promote a sale
- Generate ecommerce purchases
- Celebrate employees
- Build local awareness

The customer should be able to describe the goal naturally rather than selecting from a fixed category.

### 2. Desired Recipient Action / Primary Success Metric

What does the customer want the recipient to do?

Examples:

- Book an appointment
- Make a phone call
- Scan a QR code
- Redeem a coupon
- Visit a website
- Make a purchase
- Submit a form
- Register for an event
- Visit a physical location
- Simply receive the communication

This becomes the campaign's Primary Success Metric when appropriate.

Modern Mail should not force every campaign into a traditional conversion model.

### 3. Target Audience

Who is the customer trying to reach?

This refers to the customer's intended audience definition, not the actual mailing list.

Examples:

- Homeowners in specific ZIP codes
- Higher-income households
- Parents with young children
- Existing customers
- Local residents
- Employees of a company

Modern Mail should understand the audience concept before translating it into an actual mailing audience.

### 4. Brand and Company Information

Modern Mail should collect any relevant business information needed for the campaign.

Examples:

- Business name
- Logo
- Website
- Phone number
- Physical address
- Social media handle
- Brand colors
- Business description

Modern Mail should not ask for information that is unnecessary for the campaign.

### 5. Required Creative Assets

Modern Mail should identify any assets or elements the customer wants included.

Examples:

- Logo
- Product photographs
- Existing graphics
- Coupons
- Promotional offers
- QR codes
- Custom imagery
- Required text
- Other customer-provided objects

Customers should be able to upload assets rather than recreate them inside Modern Mail.

### 6. Desired Emotional Response

Modern Mail should understand how the customer wants the recipient to feel when they see the communication.

Examples:

- Trust
- Security
- Peace of mind
- Excitement
- Curiosity
- Urgency
- Comfort
- Confidence
- Desire

The customer should be able to describe this in their own words.

Modern Mail may suggest emotional directions when helpful, but should not require the customer to understand marketing or psychological terminology.

### Progressive Understanding

These elements do not need to be collected through six separate questions.

Modern Mail should infer information from the customer's existing answers and only ask for what remains necessary.

If the customer provides information that answers multiple requirements at once, Modern Mail should recognize and retain that information.

If a requirement is not relevant to the campaign, Modern Mail should not ask for it.

---

## Opening Experience

The Campaign Creator should begin with a simple, open-ended prompt.

The primary question should be:

> What would you like to accomplish?

Supporting text should make it clear that the customer can simply describe what they want in their own words.

Example:

> "I own an HVAC company and want to send 1,000 mailers to homeowners in this neighborhood. I want people to scan a QR code to book an appointment."

The customer should not be required to understand Modern Mail's terminology before beginning.

### Example Prompts

The interface may provide a small number of example prompts to help customers understand what they can say.

Examples should represent different campaign types rather than simply different industries.

Examples may include:

- "I want to get more appointments from homeowners nearby."
- "I want to send 1,000 postcards to this neighborhood."
- "We're opening a restaurant and want to promote our grand opening."
- "I want to send birthday cards to our employees."

Examples should guide customers without constraining them to predefined campaign types.

### Natural Language First

The text input should be the primary interaction.

Modern Mail should not force the customer to select a campaign category, success metric, audience type, or creative format before describing what they want.

Structured choices may be introduced later when they simplify a decision or help the customer respond quickly.

The experience should prioritize natural language while still allowing customers to use structured controls when useful.

---

## Conversational Questioning

Modern Mail should behave like a knowledgeable strategist having a conversation with the customer.

It should not present a checklist of required fields.

Instead, it should determine the most important missing piece of information and ask for that next.

### Example

Customer:

> "I own an HVAC company and want to send 1,000 mailers to homeowners in Irvine."

Modern Mail:

> "Got it. What would you like the people who receive it to do?"

Modern Mail may provide examples such as:

- Book an appointment
- Call you
- Request a quote
- Visit your website
- Something else

Customer:

> "I want them to book an appointment through my website."

Modern Mail:

> "Great. What's the website you'd like people to use?"

Customer:

> "abcair.com/book"

Modern Mail:

> "Got it. Who would you like to target? For example, homeowners in specific ZIP codes, a certain income range, or another type of household."

The exact questions should depend on what the customer has already told Modern Mail.

### Progressive Intelligence

Modern Mail should continuously evaluate whether it has enough information to move forward.

It should:

- Infer information from previous answers.
- Avoid repeating questions.
- Ask the most useful next question.
- Explain why information is needed when necessary.
- Skip information that is irrelevant to the campaign.
- Allow the customer to provide multiple pieces of information in a single response.
- Accept corrections and changes without restarting the campaign.

The customer should never feel like they are completing a form one field at a time.

### Knowing When to Stop Asking

Modern Mail should stop asking questions once it has enough information to confidently:

1. Define the campaign objective.
2. Identify the desired recipient action or Primary Success Metric.
3. Understand the intended target audience.
4. Identify the required company information and creative assets.
5. Establish an appropriate emotional or creative direction.
6. Generate meaningful creative concepts.

Modern Mail may identify additional information that would improve the campaign, but should not delay creative generation for information that is optional or non-essential.

The goal is not to collect every possible detail.

The goal is to collect enough information to make a strong first recommendation.

---

## Campaign Brief

As the conversation progresses, Modern Mail should maintain an internal campaign brief representing its current understanding of the customer's campaign.

The campaign brief should be updated as new information is provided or corrected.

The customer does not need to interact with this brief as a traditional form.

At minimum, the brief should be capable of representing:

- Campaign goal
- Primary Success Metric
- Supporting metrics, when applicable
- Desired recipient action
- Target audience definition
- Mailing quantity
- Business/company information
- Required creative assets
- Desired emotional response
- Offer or promotion, when applicable
- QR code destination, when applicable
- Website URL, when applicable
- Phone number, when applicable
- Other campaign-specific requirements

### Customer Confirmation

Before generating creative concepts, Modern Mail should summarize its understanding of the campaign in plain language.

For example:

> **Here's what I've got:**
>
> You're promoting your HVAC business to 1,000 homeowners in Irvine.
>
> **Goal:** Generate new appointments  
> **Primary Success Metric:** Appointment bookings  
> **Audience:** Homeowners in your selected area  
> **QR destination:** Your online booking page  
> **Secondary action:** Phone calls
>
> I'll use this information to create postcard concepts designed to encourage homeowners to book an appointment.

The customer should be able to correct or change any part of the brief before continuing.

### Confidence to Proceed

Modern Mail should only proceed to creative generation when it has sufficient confidence that it understands the campaign.

The brief does not need to be perfect.

It needs to be sufficiently complete to produce meaningful creative concepts without making important assumptions on the customer's behalf.

If a critical piece of information is missing, Modern Mail should ask for it.

If the missing information is optional, Modern Mail should proceed rather than creating unnecessary friction.

---

## Creative Generation

Once Modern Mail has sufficient confidence in the campaign brief, it should generate multiple initial creative directions.

The purpose of generating multiple concepts is to give the customer meaningful creative choices rather than presenting a single AI-generated answer.

### Initial Concepts

Modern Mail should generate approximately three distinct creative concepts.

The concepts should represent genuinely different creative directions rather than minor variations of the same design.

Differences may include:

- Visual style
- Composition
- Messaging approach
- Emotional tone
- Offer presentation
- Imagery
- Call-to-action treatment
- Information hierarchy

All concepts must remain faithful to the campaign brief.

They should reflect:

- The campaign goal
- Primary Success Metric
- Target audience
- Brand/company information
- Required creative assets
- Desired emotional response
- Required recipient action

Modern Mail should not sacrifice clarity or conversion intent for visual novelty.

### Creative Selection

The customer should be able to select one of the concepts as the direction they want to continue with.

The customer should also be able to request changes before making a final selection if none of the initial concepts are quite right.

### Iterative Creative Refinement

After selecting a concept, the customer should be able to modify the design using natural-language instructions.

Examples:

> "Change the border from red to green."

> "Make the headline bigger."

> "Replace the muffin with a friendly baker making dough."

> "Make this feel warmer and more welcoming."

> "Move my phone number to the bottom right."

Modern Mail should understand the existing selected design as context and make the requested change without unnecessarily changing unrelated elements.

The customer should not need to restart the campaign or learn a traditional design tool to make common creative changes.

### Preserving Campaign Intent

Creative modifications should preserve the underlying campaign requirements unless the customer explicitly changes them.

Modern Mail should preserve, where applicable:

- Campaign goal
- Primary Success Metric
- Target audience
- Brand requirements
- Required contact information
- Required creative assets
- QR code and destination
- Offer or promotion
- Required call to action

If a requested change could conflict with the campaign objective or a required element, Modern Mail should explain the issue and suggest an appropriate alternative rather than silently compromising the campaign.

### Customer Control

AI should generate and refine creative, but the customer remains the final decision-maker.

Modern Mail should never automatically launch or finalize a campaign based solely on an AI-generated design.

The customer must explicitly approve the final creative before proceeding to review, payment, and launch.

---

## Campaign Handoff

Once the customer approves the creative direction, Modern Mail should move them naturally into the remaining campaign setup.

The customer should not feel like they are starting a new workflow.

The campaign brief and selected creative should carry forward automatically.

The remaining steps should include, as applicable:

1. Confirm the mailing audience.
2. Confirm the quantity.
3. Confirm campaign details and tracking.
4. Review the final physical mailer.
5. Review pricing.
6. Approve and pay.
7. Launch the campaign.

### Audience

If Modern Mail is sourcing the audience, the customer should be shown a clear summary of the audience that will receive the campaign.

For example:

> **We've found 2,847 households that match your audience.**

The customer should be able to confirm the desired quantity and understand what characteristics define the audience.

If the customer has their own list, they should be able to upload it.

### Final Review

Before payment and launch, Modern Mail should provide a concise final review showing:

- What is being sent
- Who it is being sent to
- Quantity
- Primary Success Metric
- Tracking method, when applicable
- Final creative
- Total cost

The purpose of this review is confidence, not another complicated configuration step.

### Payment and Launch

The customer should explicitly approve the campaign and payment before the campaign is submitted for fulfillment.

After approval, Modern Mail should clearly communicate that the campaign has been launched and provide the expected next steps.

The customer should never be uncertain about whether a campaign was actually submitted.

### Continuity

The information established during Campaign Creator should remain connected to the campaign after launch.

The same campaign should ultimately feed:

- Campaign status
- Measurement
- Campaign Confidence
- AI Strategist recommendations
- Historical campaign learning

---

## Beta Scope

The 60-day private beta should prioritize the smallest high-quality experience that allows real customers to successfully create, send, and measure physical outreach.

The Campaign Creator beta should prove the core workflow rather than attempt to build every future capability.

### Beta Must Support

- Natural-language campaign description
- Progressive AI questioning
- Campaign brief generation
- Goal and Primary Success Metric identification
- Target audience definition
- Company and brand information
- Required creative asset collection
- Desired emotional response
- Multiple initial creative concepts
- Customer selection of a concept
- Natural-language creative refinement
- Customer approval of final creative
- Handoff to audience selection
- Handoff to campaign review and launch

### Beta Does Not Need to Perfect

The following capabilities may begin with constrained or semi-manual implementations:

- Advanced autonomous marketing strategy
- Fully automated audience generation
- Every possible audience data source
- Fully automated physical fulfillment
- Advanced attribution across every CRM or ecommerce platform
- Complex multi-touch campaign orchestration
- Unlimited creative editing capabilities
- Fully autonomous AI campaign optimization

The beta should favor reliable execution of the core customer journey over breadth.

### Beta Principle

When choosing between a sophisticated feature that expands scope and a simpler implementation that allows a real customer to successfully complete the campaign, prioritize the simpler implementation unless it materially compromises the customer experience or product promise.

The goal of the beta is to learn from real customers while maintaining the quality, philosophy, terminology, and UX principles established in the Product Bible and UX Manifesto.