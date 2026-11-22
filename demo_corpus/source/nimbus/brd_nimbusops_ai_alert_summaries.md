---
title: BRD – NimbusOps AI Alert Summaries
access: Product
format: docx
doc_no: NIM/ENG/PRO-001
version: 1.0
effective: 15 July 2026
review: 31 January 2027
classification: Confidential
department: NimbusOps Product
prepared_by: Ishaan Verma, Product Analyst – NimbusOps
approved_by: Meera Iyer, Chief Technology Officer
stamp: APPROVED
---
# BRD – NimbusOps AI Alert Summaries

Business requirements for a new NimbusOps feature that groups related alerts into one incident and writes a short plain-language summary of what is happening. Engineering design follows in a separate design document once this BRD is approved.

## 1. Problem

NimbusOps serves about 140 customers and evaluates about 1.3 million active alert rules. When something breaks in a customer's environment, one root cause often fires dozens of alerts across hosts, containers and services. Customer interviews and support data from April–June 2026 show:

- The median customer incident produces **23 alert notifications**; the worst 10% produce more than 150.
- On-call engineers at customers spend an estimated 9 minutes per incident working out which alerts belong together before they start fixing anything.
- "Alert noise" was the top reason given by the 6 customers who churned in FY2025-26 and the second most requested improvement in the March 2026 customer survey (cited by 41% of respondents).

## 2. Goals and success metrics

| # | Goal | Metric | Baseline | Target (6 months after GA) |
|---|---|---|---|---|
| G1 | Cut alert noise | Notifications sent per incident (median) | 23 | **Reduce by 60%** (to 9 or fewer) |
| G2 | Faster understanding | Mean time to acknowledge (MTTA) | 11 min | Reduce by 30% |
| G3 | Useful summaries | Summaries rated "helpful" by users | n/a | 75% or more |
| G4 | Correct grouping | Alerts wrongly grouped (sampled monthly) | n/a | Below 5% |
| G5 | Retention | Net revenue retention of customers using the feature | 116% (all NimbusOps) | 120% |

## 3. Users

| User | Need |
|---|---|
| Customer on-call engineer | One notification per incident with a summary that says what is affected, since when, and the likely starting point |
| Customer operations manager | Fewer pages for the team; weekly report of noisy rules |
| Nimbus NOC (Managed Services) | The same grouping for the managed customers it monitors 24x7 |
| Customer Success Manager | Usage and helpfulness data per account |

## 4. Plan availability

| Plan | AI alert summaries | Notes |
|---|---|---|
| Starter | **Not included** | Starter evaluates alerts every 60 seconds and has no incident grouping |
| Standard | **Included** | Grouping and summaries for up to 1,000 incidents per month per account |
| Enterprise | **Included** | Unlimited incidents, plus weekly noise report and summary export via the public API |

No separate add-on is planned for Starter in FY27. Commercial terms for Standard and Enterprise are unchanged by this feature; pricing decisions are owned by Sales and are outside this BRD.

## 5. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Group alerts that start within a 5-minute window and share a host, service, Kubernetes namespace or dependency path into one incident. | Must |
| FR-02 | Generate a summary of at most **80 words** within **60 seconds** of the incident being opened, and update it when new alerts join. | Must |
| FR-03 | The summary states: affected services and hosts, start time, number of alerts, the earliest alert (likely starting point) and the current severity. | Must |
| FR-04 | Severity follows the NimbusOps scale SEV1–SEV4 (SEV1 customer-wide outage, SEV2 degraded, SEV3 single component, SEV4 informational). | Must |
| FR-05 | Send one notification per incident to the customer's channels (email, Slack, Microsoft Teams, PagerDuty, webhook) instead of one per alert. Users can still open every underlying alert. | Must |
| FR-06 | Users can split a wrongly grouped alert out of an incident with one click; this feedback is stored to improve grouping. | Must |
| FR-07 | Users rate each summary "helpful" or "not helpful". | Should |
| FR-08 | Account admins can switch the feature off for the whole account or per alert rule. | Must |

## 6. Data, security and compliance

- All processing stays in AWS **ap-south-1 (Mumbai)**, the NimbusOps primary region, with failover to ap-south-2 (Hyderabad). No alert data leaves India, in line with the NimbusOps data residency commitment.
- The language model runs inside the NimbusOps AWS account; customer data is **not used to train** any model and is not shared with third parties.
- Only alert metadata (rule name, host, service, metric value, timestamps) is sent to the model, never raw log lines.
- Summaries are stored with the incident and follow the same 13-month retention as events.
- The feature must pass a SOC 2 Type II control review before GA, as it adds a new processing component within the audit scope.
- Every summary is labelled "AI-generated" in the UI and notifications.

## 7. Rollout plan

| Phase | Dates | Who | Exit criteria |
|---|---|---|---|
| Internal dogfood | August 2026 | Nimbus "meta" tenant and the Nimbus NOC | No P1 defects; grouping error below 10% |
| Private beta | 1 October – 15 December 2026 | **15 customers** (10 Enterprise, 5 Standard), by invitation | 70% helpful ratings; G1 at least 40% |
| General availability | **January 2027** | All Standard and Enterprise customers, switched on by default | SOC 2 control review passed |

Beta customers are chosen by Customer Success; Harbor Logistics' NimbusOps edge monitoring is excluded from the beta while its renewal is in progress.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Wrong grouping hides a separate, more serious incident | Never group across tenants or across SEV1 boundaries; FR-06 one-click split |
| Summary states a wrong cause | Summary describes symptoms and the earliest alert only; it never claims a root cause |
| Model cost grows with incident volume | Standard plan limit of 1,000 incidents per month; cost per summary tracked weekly |
| Customer concern about AI on their data | Clear data statement (Section 6) in the product FAQ and in the trust centre |

## 9. Approval

Product owner: Ishaan Verma. Engineering owner: Neha Gupta (Engineering Manager, NimbusOps). Approved by Meera Iyer (CTO) on 15 July 2026. The security review is owned by the CISO, Sameer Khan.
