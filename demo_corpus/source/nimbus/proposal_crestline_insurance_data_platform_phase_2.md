---
title: Proposal – Crestline Insurance Data Platform Phase 2
access: Sales
format: pdf
doc_no: NIM/SAL/PRO-001
version: 1.1
effective: 28 August 2026
review: 27 October 2026
classification: Confidential
department: Sales – North America
prepared_by: Arjun Nair, VP Sales – North America
approved_by: Rohan Bhatia, Chief Financial Officer
stamp: CONFIDENTIAL
---
# Proposal – Crestline Insurance Data Platform Phase 2

Prepared for: Ellen Whitaker, Chief Data Officer, Crestline Insurance Group, Hartford, Connecticut.
Proposal validity: 60 days from 28 August 2026.

## 1. Executive summary

In Phase 1 (July 2025 – June 2026) Nimbus and Crestline replaced the Teradata warehouse with an Azure Databricks lakehouse, on time and with all six milestones accepted. Report run times fell 38% and nightly data is ready before 05:00 ET.

Phase 2 turns that foundation into business value for the claims organisation. We propose a 14-month programme, **1 October 2026 to 30 November 2027**, to deliver:

1. A **Claims 360 analytics** product for claims leadership and adjusters;
2. A **fraud detection model** scoring every new first notice of loss (FNOL);
3. **Subrogation opportunity identification** to recover more paid losses;
4. A controlled **GenAI claims-file summarisation pilot** for complex commercial claims.

Total investment: **USD 3.85 million**. Expected annual benefit to Crestline once live: USD 9–12 million, mainly from fraud avoidance and subrogation recovery.

## 2. Understanding of Crestline's needs

- Claims leakage is estimated by Crestline at 6–8% of paid losses; fraud referrals today depend on adjuster judgment and a rules engine with a 9% hit rate.
- Subrogation recovery is 2.1% of paid losses versus an industry benchmark of about 3%.
- Adjusters spend 35–45 minutes reading a complex claim file before the first call.
- Claims data now sits in the gold layer built in Phase 1, but there is no ML platform, feature store or model governance yet.

## 3. Proposed solution

### 3.1 Workstreams

| # | Workstream | Key deliverables |
|---|---|---|
| A | ML platform and MLOps | Databricks feature store, MLflow model registry, CI/CD for models, monitoring for drift and bias |
| B | Claims 360 | Unified claim timeline, 14 Power BI dashboards, adjuster workload views |
| C | Fraud detection | Gradient-boosted model on FNOL + network features, scoring API integrated with the claims system, referral workflow for the Special Investigations Unit (SIU) |
| D | Subrogation | Model flagging recoverable claims, prioritised work queue, recovery tracking |
| E | GenAI pilot | Summarisation of claim files for 50 adjusters, human-in-the-loop review, evaluation of accuracy and time saved |

### 3.2 Model governance

All models follow a model risk framework aligned to Crestline's model governance policy and state insurance regulators' guidance on AI in insurance: documented purpose, bias testing across protected classes, explainability (SHAP) for every fraud referral, and quarterly performance reviews. The GenAI pilot uses only Crestline-approved models deployed in Crestline's Azure tenant; no claim data leaves the tenant.

### 3.3 Success measures

| Measure | Baseline | Target (6 months after go-live) |
|---|---|---|
| SIU referral hit rate | 9% | ≥ 20% |
| Subrogation recovery (% of paid losses) | 2.1% | 2.7% |
| Adjuster file review time (complex claims, pilot group) | 40 min | 15 min |
| Claims dashboards adoption (weekly active users) | n/a | 400 |

## 4. Plan

| Phase | Dates | Milestone |
|---|---|---|
| Mobilise and design | 1 Oct – 15 Nov 2026 | Architecture and model governance plan approved |
| ML platform | 16 Nov 2026 – 31 Jan 2027 | MLOps platform live |
| Claims 360 release 1 | Nov 2026 – Mar 2027 | 8 dashboards live |
| Fraud model build and validation | Jan – May 2027 | Model approved by Crestline model risk committee |
| Fraud model production + SIU workflow | June 2027 | Scoring live on 100% of FNOL |
| Subrogation model | Apr – Aug 2027 | Work queue live |
| GenAI pilot | Mar – Jul 2027 | Pilot evaluation report |
| Hypercare and handover | Sep – Nov 2027 | Programme closure 30 Nov 2027 |

## 5. Team

| Role | FTE (average) | Location |
|---|---|---|
| Engagement manager and lead architect | 2 | Hartford |
| Data scientists / ML engineers | 10 | Bengaluru, Hyderabad |
| Data engineers | 12 | Bengaluru |
| BI developers | 4 | Hyderabad |
| GenAI engineers | 3 | Bengaluru |
| QA, model validation support | 2 | Bengaluru |
| Project manager | 1 | Bengaluru |
| **Total** | **34** | |

We will retain the Phase 1 engagement lead and lead data architect, and at least 60% of the Phase 1 engineering team.

## 6. Commercials

| Component | Model | USD |
|---|---|---|
| Workstreams A–D | Fixed fee, milestone-based | 3,020,000 |
| Workstream E (GenAI pilot) | Time and materials, capped | 380,000 |
| Hypercare and model operations (Sep–Nov 2027) | Fixed fee | 450,000 |
| **Total** | | **3,850,000** |

- The price includes a **4% loyalty discount** on list rates in recognition of Phase 1 (USD 160,400), already reflected above.
- Annual escalation: 3% applies to any extension beyond 30 November 2027.
- Payment terms: net 30 days on milestone acceptance; T&M invoiced monthly.
- Travel and expenses at actuals, capped at USD 95,000.
- Azure, Databricks and model hosting consumption are paid directly by Crestline.

## 7. Assumptions

1. Crestline provides access to SIU historical referral outcomes for at least 5 years.
2. Crestline's model risk committee reviews models within 15 business days of submission.
3. Claims system integration uses Crestline's existing API gateway; no changes to the core claims system are required from Nimbus.
4. Crestline nominates a product owner for each workstream with at least 50% availability.

## 8. Why Nimbus

- Proven delivery on Phase 1: six of six milestones accepted, team already knows Crestline's data.
- Data & AI practice of 640 engineers, 110 of them in ML and GenAI.
- Insurance accelerators: claims data model, fraud feature library with 180 prebuilt features.
- SOC 2 Type II and ISO 27001:2022 certified operations.

## 9. Next steps

1. Solution walkthrough with Crestline claims and SIU leadership – week of 14 September 2026.
2. Commercial discussion with Crestline procurement – by 30 September 2026.
3. Target signature 20 October 2026 for a 2 November 2026 start if 1 October is not achievable; the plan then shifts by one month.
