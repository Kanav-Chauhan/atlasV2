---
title: Cloud Cost Management Guideline
access: Engineering
format: pdf
doc_no: NIM/ENG/GDL-001
version: 1.3
effective: 01 April 2026
review: 31 March 2027
classification: Internal
department: Infrastructure & SRE
prepared_by: Pradeep Joshi, Head of Infrastructure & SRE
approved_by: Rohan Bhatia, Chief Financial Officer
stamp: APPROVED
---
# Cloud Cost Management Guideline

## 1. Purpose

Cloud spend is Nimbus Infotech's third-largest cost after people and facilities. This guideline sets out how engineering teams plan, tag, monitor and optimise spending on AWS and Azure for NimbusOps, internal platforms and client sandboxes, so that every rupee can be traced to an owner and a purpose.

## 2. Scope

- All AWS accounts in the Nimbus AWS Organization and all Azure subscriptions under the Nimbus tenant.
- Client-owned cloud accounts are excluded (the client pays directly), except where Nimbus re-bills cloud cost under a contract; those follow Section 8.

## 3. Roles

| Role | Responsibility |
|---|---|
| Account owner (EM or project manager) | Budget for the account, monthly review, acting on alerts |
| FinOps lead (Infrastructure & SRE) | Reports, commitments (Savings Plans, Reserved Instances), anomaly triage |
| Head of Infrastructure & SRE (Pradeep Joshi) | Approves commitments and large new spend |
| CFO (Rohan Bhatia) | Approves annual cloud budget and commitments above ₹1 crore |

## 4. Mandatory tagging

Every resource that supports tags **must** carry these tags. Untagged resources are reported daily and, in non-production accounts, stopped after 7 days.

| Tag key | Example | Purpose |
|---|---|---|
| `cost-centre` | `CC-ENG-NOPS` | Maps to the finance cost centre |
| `owner` | `neha.gupta` | Accountable person |
| `env` | `prod` / `staging` / `dev` / `sandbox` | Environment |
| `service` | `alert-evaluator` | Application or component |
| `client` | `harbor-logistics` / `internal` | Client re-billing and project margin |
| `expiry` | `2026-12-31` | Required for `sandbox` resources |

Tag compliance target: **≥ 95% of monthly spend tagged** correctly. FY26 closed at 91%.

## 5. Budgets and alerts

1. Every account has a monthly budget in AWS Budgets / Azure Cost Management, set during annual planning.
2. Alerts go to the account owner and `#finops` at **80%** (forecast) and **100%** (actual) of the monthly budget; at **120%** the alert also goes to Pradeep Joshi.
3. Daily cost anomaly detection flags any service whose spend is more than ₹50,000 or 40% above its 14-day average.
4. Account owners must acknowledge an anomaly within 2 business days with an explanation or a fix.

## 6. Approval thresholds for new spend

| Expected new recurring spend | Approval |
|---|---|
| Up to ₹1 lakh per month | Account owner |
| ₹1 lakh to ₹5 lakh per month | Engineering Manager + FinOps lead |
| Above ₹5 lakh per month | Head of Infrastructure & SRE |
| Above ₹25 lakh per month, or any commitment above ₹1 crore | CFO |

Requests are raised in the `FINOPS` Jira project with an estimate from the AWS Pricing Calculator.

## 7. Optimisation rules

### 7.1 Non-production environments

- Development and staging EKS node groups scale to zero from **20:00 to 08:00 IST** on weekdays and all weekend, unless an exception tag `always-on=true` is approved by the EM.
- Sandbox accounts have a hard limit of **₹40,000 per month per engineer**; resources are deleted on the `expiry` date.
- Non-production RDS instances use the smallest instance class that passes tests and are stopped outside working hours.

### 7.2 Production

- Compute commitments: target **70% coverage** of steady-state EC2/EKS compute with Compute Savings Plans (1-year, no upfront). Coverage reviewed monthly; current coverage 64%.
- Graviton (ARM) instances are the default for new stateless services where the runtime supports it (expected saving ~20%).
- S3 lifecycle policies are mandatory: move objects to Infrequent Access after 30 days and to Glacier Instant Retrieval after 90 days unless the data class requires otherwise.
- Log volume is a major cost driver; follow retention limits in the Logging and Observability Standard (NIM/ENG/STD-004).
- Cross-AZ traffic: prefer topology-aware routing for chatty services.

### 7.3 Rightsizing

FinOps publishes a rightsizing report on the 5th of every month. Recommendations with an expected saving above ₹25,000 per month must be actioned or rejected with a reason within 30 days.

## 8. Client re-billing

Where a contract allows Nimbus to re-bill cloud cost (for example, managed environments for Al Noor Healthcare), the `client` tag drives a monthly cost report sent to the Delivery Manager by the 7th working day. The contractual mark-up, if any, is applied by Finance, not by engineering.

## 9. Unit economics

NimbusOps tracks cloud cost per monitored host as its key efficiency metric.

| Metric | FY26 actual | FY27 target |
|---|---|---|
| NimbusOps cloud cost per monitored host per month | ₹76 | ≤ ₹67 |
| NimbusOps cloud cost as % of NimbusOps revenue | 24% | ≤ 21% |
| Non-production share of total cloud spend | 31% | ≤ 25% |
| Savings Plan coverage | 64% | 70% |

## 10. Reporting

- Weekly: top 10 cost movers posted in `#finops` every Monday.
- Monthly: cost review per cost centre with EMs; consolidated report to the CTO and CFO.
- Quarterly: commitment review (Savings Plans renewals and purchases) chaired by Pradeep Joshi.

## 11. Non-compliance

Repeated failure to tag or to respond to budget alerts is escalated to the CTO. FinOps may stop non-production resources that breach these rules after giving 48 hours' notice to the owner.
