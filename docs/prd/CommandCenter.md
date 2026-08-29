# Command Center PRD

## Purpose

The Command Center is the home screen of Modern Mail.

It should allow customers to understand the health of their physical outreach within 10 seconds of logging in.

The Command Center should answer four questions:

1. What happened?
2. What is happening?
3. What should I do next?
4. What opportunities exist?

---

## Primary Goal

Give customers immediate clarity and confidence without requiring them to dig through menus or reports.

The Command Center should feel like a trusted advisor—not a spreadsheet.

---

## User Types

### New User

No campaigns exist.

Guide them toward launching their first campaign.

### Active User

One or more campaigns are running.

Show campaign health, upcoming deliveries, and recommended actions.

### Power User

Many campaigns are active.

Surface trends, AI insights, optimization opportunities, and important changes.

---

## Success Criteria

A customer should understand the state of their business within 10 seconds.

A customer should know exactly what action to take next.

A customer should never wonder where to click.

## Founder Review #1 – Design Discoveries
This section captures product decisions made during founder design reviews before implementation. These discoveries should be treated as requirements for future iterations of the Command Center.

## Founder Review #2 – Campaign Confidence

Campaign Confidence is the signature UI component of Modern Mail.

It is not a KPI, scorecard, or dashboard metric.

Its purpose is to answer one question in under one second:

> "Is my campaign on track to accomplish its goal?"
Campaign Confidence should be based on the customer's Primary Success Metric rather than a universal definition of success.

Examples:

- HR → Successful deliveries
- HVAC → Phone calls
- Restaurant → QR scans
- Real Estate → Landing page visits

The component should communicate confidence through both visual design and plain-English explanations.

### Design Principles

- Campaign Confidence is the visual centerpiece of the Command Center.
- It should be recognizable throughout the product.
- It should communicate status before the user reads any text.
- It should explain *why* Modern Mail has high, moderate, or low confidence.
- It should encourage confidence, not anxiety.

### Visual Direction

The component should center around a minimal Confidence Ring.

The ring should represent confidence levels rather than a numeric percentage.

Preferred levels:

- High
- Moderate
- Low

The center of the ring should display the confidence level instead of a score.

Below the ring, Modern Mail explains why it reached that conclusion in plain English.

Campaign Confidence represents Modern Mail's interpretation of campaign performance—not raw analytics.



### 1. The page should answer the user's question immediately.

The Command Center should no longer begin with a generic greeting.

Instead, it should immediately answer the question:

> "How's my mail doing?"

The purpose of the page is to answer the customer's primary question before presenting analytics.


### 2. Campaign Confidence replaces generic Business Health.

"Business Health" is too subjective because every customer defines success differently.

Campaign Confidence measures how likely Modern Mail believes the campaign is to achieve the customer's Primary Success Metric.

Examples:

- HR → Successful delivery
- HVAC → Phone calls
- Restaurant → QR scans
- Realtor → Landing page visits

The UI remains the same while the confidence model adapts to each customer's business objective.


### 3. The screen should tell a story.

The information hierarchy should become:

1. How's my mail doing?
2. Campaign Confidence
3. Mail Status
4. AI Strategist
5. Supporting metrics

The page should feel like guidance, not reporting.

### 4. The Command Center is a decision engine.

Customers should never have to interpret raw metrics.

Modern Mail should interpret campaign performance and communicate confidence, evidence, and recommended actions in plain English.

Every section should help customers decide what to do next.

