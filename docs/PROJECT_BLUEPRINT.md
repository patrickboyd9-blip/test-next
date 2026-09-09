# Modern Mail AI
## PROJECT_BLUEPRINT.md

**Version:** 1.0  
**Last Updated:** September 2026

---

# Executive Summary

Modern Mail is an AI-powered direct mail platform that helps businesses plan, design, optimize, and eventually order highly effective direct-mail campaigns.

The goal is **not** to become another Canva or postcard editor.

The goal is to become an **AI Direct Mail Strategist**.

Modern Mail should function like hiring an experienced direct-mail consultant who understands:

- strategy
- copywriting
- list selection
- print production
- campaign optimization
- attribution
- ROI
- USPS requirements
- production vendors

The software should think before it creates.

---

# Product Vision

A customer should be able to answer a few questions such as:

> I own a plumbing company.

> I want more drain cleaning jobs.

> My budget is $3,500.

…and Modern Mail should produce:

- Campaign strategy
- Campaign score
- Campaign audit
- Audience recommendation
- Offer recommendation
- Mail format
- Mail cadence
- Messaging strategy
- Full postcard copy
- AI-generated artwork
- Mailing list recommendation
- Print-ready PDF
- Estimated costs
- Estimated ROI
- One-click production ordering

Eventually the customer clicks:

> **Order Campaign**

…and Modern Mail handles the rest.

---

# Core Product Philosophy

Modern Mail should **never** rely on one giant AI prompt.

Instead it should think like a consulting firm.

Every stage performs one responsibility.

```
Campaign Brief
        │
        ▼
Evaluation
        │
        ▼
Recommendations
        │
        ▼
Audit
        │
        ▼
Strategy
        │
        ▼
Creative
        │
        ▼
Production
```

The AI is only responsible for creative generation.

Business logic should remain deterministic whenever possible.

---

# Current Architecture

```
Campaign Brief
        │
        ▼
Conversation Engine
        │
        ▼
Campaign Evaluator
        │
        ▼
Recommendation Engine
        │
        ▼
Campaign Audit
        │
        ▼
Industry Playbooks
        │
        ▼
Strategy Generator
        │
        ▼
Mailer Generator
        │
        ▼
Prompt Builder
        │
        ▼
Claude
```

---

# Major Components

## 1. Campaign Conversation Engine

Purpose:

Collect campaign requirements from users through AI conversation.

Responsibilities:

- ask follow-up questions
- collect missing information
- produce CampaignBrief

Produces:

```
CampaignBrief
```

---

## 2. Campaign Evaluator

Purpose:

Analyze campaign quality.

Responsibilities:

- campaign scoring
- issue detection
- confidence calculation
- validation

Current Rule Set:

- Missing goal
- Missing audience
- Missing offer
- Missing success metric

Future Rule Set:

30–50 evaluation rules.

Examples:

- Weak CTA
- Weak urgency
- Poor offer
- Audience too broad
- Missing tracking
- Wrong format
- Poor cadence
- Missing credibility
- Missing testimonials
- Weak headline
- No personalization

Produces:

```
CampaignEvaluation
```

Current outputs:

- score
- confidence
- issues
- missing information

---

## 3. Recommendation Engine

Purpose:

Convert issues into recommendations.

Produces:

```
RecommendationResult
```

Contains:

- evaluation
- recommendations

---

## 4. Campaign Audit

Purpose:

Produce a customer-friendly report.

Outputs:

- Overall Score
- Confidence
- Critical Issues
- Warnings
- Strengths
- Opportunities
- Estimated Impact

This object is intended for UI presentation.

---

## 5. Industry Playbooks

Purpose:

Provide industry-specific intelligence.

Current:

- Plumbing

Future:

- HVAC
- Roofing
- Solar
- Insurance
- Dentistry
- Legal
- Financial Advisors
- Landscaping
- Pest Control
- Home Services
- Real Estate
- Medical
- Auto Repair
- Restoration
- etc.

Playbooks should contain:

- recommended offers
- cadence
- messaging
- mail formats
- seasonal advice
- objections
- best-performing concepts

---

## 6. Strategy Generator

Purpose:

Convert recommendations into a structured strategy.

Produces:

```
CampaignStrategy
```

Contains:

- audience
- offer
- format
- cadence
- messaging
- CTA
- KPIs
- assumptions

This object should become increasingly intelligent over time.

Eventually it should recommend:

- list size
- budget allocation
- frequency
- seasonality
- testing strategy

---

## 7. Mailer Generator

Purpose:

Create the structured mail piece.

Produces:

```
GeneratedMailer
```

Contains:

- headline
- subheadline
- front
- back
- CTA
- offer
- layout notes
- image suggestions
- compliance notes
- reasoning

Currently this generates a skeleton.

Future versions will be AI-generated.

---

## 8. Prompt Builder

Purpose:

Assemble structured information into the AI prompt.

Should include:

- strategy
- recommendations
- score
- confidence
- playbook
- direct-mail principles

Prompt Builder should contain **zero business logic**.

Only prompt composition.

---

## 9. Principles

Purpose:

Store universal direct-mail best practices.

Examples:

- one message
- one CTA
- urgency
- credibility
- personalization
- visual hierarchy
- response optimization

---

## 10. Discovery Framework

Purpose:

Help AI collect missing campaign information.

---

# Current Folder Structure

```
lib/

campaign-creator/
    conversation engine
    anthropic integration
    types

campaign-strategy/

    campaign-evaluator.ts
    campaign-audit.ts
    strategy-generator.ts
    recommendation-engine.ts
    prompt-builder.ts

    evaluation-types.ts
    recommendation-types.ts
    strategy-types.ts
    audit-types.ts
    mailer-types.ts

    playbooks/
        index.ts
        plumbers.ts

    rules/
        missing-goal.ts
        missing-offer.ts
        missing-audience.ts
        missing-success-metric.ts
        rule.ts

    principles.ts
    discovery-framework.ts
```

---

# Development Philosophy

Always keep:

Business Logic

↓

AI Prompt

↓

Creative Generation

Separate.

Never hide business logic inside prompts.

Every stage should be testable independently.

---

# Current Milestones Completed

✅ Campaign Brief

✅ Conversation Engine

✅ Evaluation Types

✅ Campaign Evaluator

✅ Rule Engine

✅ Recommendation Engine

✅ Campaign Audit

✅ Industry Playbooks

✅ Strategy Generator

✅ Mailer Generator (Skeleton)

✅ Prompt Builder

Everything currently compiles with **zero TypeScript errors**.

---

# Current Status

The strategic foundation is complete.

The application now thinks about campaigns before asking the AI to generate creative.

The next phase should focus on making outputs production-ready rather than adding more infrastructure.

---

# Immediate Next Milestone

## Click2Mail Evaluation

Before implementing AI-generated mail pieces, evaluate Click2Mail as the production partner.

Gather and review:

- REST API documentation
- Authentication
- Artwork upload endpoints
- Job creation
- Proof generation
- Pricing
- Address validation
- Variable data support
- PDF requirements
- Bleed
- Trim
- Safe areas
- Supported products
- Layout templates
- USPS constraints

Reason:

The mailer generator should produce artwork that already fits the production vendor's requirements.

Avoid generating generic postcards that later require redesign.

---

# Planned Roadmap

## Phase 2

### AI Strategy

- richer strategy generation
- better recommendations
- advanced scoring

---

### AI Mailer Generation

Generate:

- postcard copy
- letter copy
- self-mailers
- brochures

---

### AI Artwork

Generate:

- postcard front
- postcard back
- imagery
- layout concepts
- production-aware designs

---

### Click2Mail Integration

Support:

- upload artwork
- proofs
- ordering
- pricing
- job tracking

---

### Data Axle Integration

Recommend mailing lists.

Future capabilities:

- homeowner filters
- income
- home value
- years in home
- owner occupied
- business SIC
- NAICS
- radius targeting
- carrier routes

The Strategy Engine should determine the audience first.

Data Axle should simply execute those recommendations.

---

### Knowledge Base

Create a permanent knowledge system containing:

- winning direct mail
- swipe files
- USPS documentation
- Dan Kennedy
- Gary Halbert
- David Ogilvy
- production guidelines
- historical campaign performance
- print best practices

This knowledge should continuously improve AI recommendations.

---

### Campaign Optimization

Future AI features:

- rewrite campaigns
- improve headlines
- strengthen offers
- estimate response rate
- estimate ROI
- recommend A/B tests
- predict weaknesses

---

### Production Pipeline

Eventually:

```
Campaign

↓

Strategy

↓

Creative

↓

Artwork

↓

Proof

↓

Print

↓

Mail

↓

Tracking

↓

Optimization
```

---

# Coding Standards

- TypeScript-first
- Strong typing
- Modular architecture
- Small focused files
- One responsibility per component
- Business logic outside prompts
- AI only where creativity is required

---

# Current Stopping Point

Development paused immediately before:

**Evaluating Click2Mail production constraints.**

Reason:

Production templates should influence the AI mailer architecture before implementing AI-generated creative.

After Click2Mail evaluation, continue with:

1. Production-aware mailer generation
2. AI copy generation
3. AI artwork generation
4. Data Axle integration

---

# Long-Term Vision

Modern Mail should become the operating system for direct mail.

Not simply software that designs postcards.

Instead:

- understands marketing
- understands printing
- understands mailing lists
- understands ROI
- understands creative
- understands production
- understands optimization

The AI should function like a senior direct-mail strategist that can take a campaign from idea to mailbox with minimal user effort.

The ultimate user experience should feel less like filling out software and more like collaborating with an experienced marketing team.