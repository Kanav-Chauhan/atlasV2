---
title: Harbor Logistics – Account Overview
access: Engineering
format: docx
doc_no: NIM/DEL/RPT-001
version: 5.0
effective: 01 July 2026
review: 30 September 2026
classification: Confidential
department: Delivery – North America
prepared_by: Karthik Subramanian, Delivery Manager – Harbor Logistics
approved_by: Kavya Reddy, VP Delivery
stamp: none
---
# Harbor Logistics – Account Overview

## 1. Client snapshot

| Item | Detail |
|---|---|
| Client | Harbor Logistics Inc. |
| Headquarters | Savannah, Georgia, USA |
| Industry | Third-party logistics, warehousing and freight forwarding |
| Size | ~9,800 employees, 41 distribution centres in the US |
| Relationship since | October 2023 |
| Contract | Master Services Agreement (MSA) + SOW-HL-002 (cloud migration and run) |
| Annual contract value | USD 4.2 million |
| Current term ends | 30 September 2026 (renewal due) |
| Nimbus service line | Cloud & Platform Engineering, with Managed Services for migrated workloads |
| Account tier | Strategic (top-5 account by revenue) |

## 2. Engagement summary

Harbor engaged Nimbus in October 2023 to move its application estate from two ageing on-premises data centres (Savannah, GA and Memphis, TN) to AWS (us-east-1 primary, us-west-2 DR) and to run the migrated workloads under a 24x7 managed service. The Savannah data centre was exited in March 2025. The Memphis exit is the main objective of the current year.

### 2.1 Scope

1. Migration of **412 applications** in 14 waves (rehost 58%, replatform 31%, refactor 6%, retire 5%).
2. Landing zone build and governance (AWS Control Tower, 64 accounts).
3. Managed cloud operations: monitoring via NimbusOps, patching, backup, cost optimisation.
4. Application support (L2) for 37 business-critical applications, including the warehouse management system **HarborTrack**.

### 2.2 Progress at a glance (30 June 2026)

| Measure | Value |
|---|---|
| Applications migrated | 287 of 412 (70%) |
| Waves complete | 9 of 14 |
| Memphis data centre exit target | 31 December 2026 |
| On-prem servers decommissioned | 1,140 of 1,690 |
| Harbor infrastructure run-cost reduction to date | 27% vs. FY2023 baseline |

## 3. Commercials

| Component | Model | Annual value (USD) |
|---|---|---|
| Migration factory (waves) | Fixed price per wave | 1.65 million |
| Managed cloud operations | Monthly fixed fee (USD 112,500/month) | 1.35 million |
| Application support (L2) | Time and materials, capped | 0.84 million |
| Landing zone and FinOps | Fixed fee | 0.36 million |
| **Total** | | **4.20 million** |

- Invoicing monthly in arrears, payment terms net 45 days. Days sales outstanding (DSO) currently 52 days.
- Account gross margin FY2025-26: **34.1%** (company target for strategic accounts: 32%).
- Service credits are capped at 10% of the monthly managed services fee.

## 4. Team

| Location | Role | FTE |
|---|---|---|
| Onshore (Savannah / remote US) | Engagement lead, cloud architects, migration leads | 16 |
| Offshore Pune | Migration factory, landing zone, FinOps | 31 |
| Offshore Bengaluru | Managed operations (NOC), application support | 21 |
| **Total** | | **68** |

## 5. Key relationships

| Harbor | Role | Nimbus counterpart | Relationship health |
|---|---|---|---|
| Margaret Ellison | CIO, executive sponsor | Arjun Nair (VP Sales, North America) | Good |
| Tom Reyes | VP Infrastructure, day-to-day owner | Karthik Subramanian (Delivery Manager) | Strained after INC-2291, improving |
| Linda Park | Director, IT Procurement | Arjun Nair | Neutral |
| Raj Patel | Director, Warehouse Systems (HarborTrack owner) | Daniel Brooks (Engagement Lead, onshore) | Good |

Nimbus executive sponsor for the account: Kavya Reddy, VP Delivery. Quarterly business reviews (QBRs) are held in Savannah in the first month of each calendar quarter.

## 6. Governance

| Forum | Frequency | Attendees |
|---|---|---|
| Weekly status | Weekly, Wednesday 09:00 ET | Tom Reyes, Karthik Subramanian, wave leads |
| Change Advisory Board | Weekly, Thursday | Harbor CAB, Nimbus migration leads |
| Steering committee | Monthly | Margaret Ellison, Tom Reyes, Kavya Reddy, Arjun Nair |
| QBR | Quarterly | Executives of both companies |

## 7. Service performance (FY2025-26)

| SLA | Target | Actual |
|---|---|---|
| Availability of managed production workloads | 99.9% | 99.93% |
| P1 response | 15 minutes | 100% met |
| P1 resolution | 4 hours | 92% met |
| Patch compliance (critical within 14 days) | 95% | 97% |
| CSAT (quarterly survey) | ≥ 8.0 / 10 | 8.1 / 10 |

## 8. Risks and issues

| # | Risk / issue | Impact | Mitigation | Owner |
|---|---|---|---|---|
| 1 | INC-2291 (11 June 2026) outage of HarborTrack during wave 9 cutover damaged confidence | High | Post-mortem actions, extra cutover checks, service credit of USD 17,500 issued | Karthik Subramanian |
| 2 | Renewal due 30 September 2026; Harbor procurement seeking price reduction | High | Renewal plan in Sales Proposals; multi-year offer with expanded scope | Arjun Nair |
| 3 | Mainframe-dependent apps (11) in waves 13–14 may slip Memphis exit | Medium | Early assessment with Harbor's mainframe vendor; contingency co-location quote | Daniel Brooks |
| 4 | Attrition in Bengaluru NOC team (22% annualised) | Medium | Retention bonuses approved for 6 key engineers; cross-training from Pune | Karthik Subramanian |

## 9. Growth opportunities

- Data platform for freight visibility analytics (estimated USD 1.1 million), introduced to Margaret Ellison at the April 2026 QBR.
- NimbusOps licences for Harbor's 41 distribution centres' edge infrastructure (estimated USD 180,000 per year).
- Managed SOC services, leveraging the Al Noor Healthcare SOC capability in Hyderabad.

## 10. Account plan priorities (FY27)

1. Secure renewal before 30 September 2026 with a minimum 3-year term.
2. Complete waves 10–14 and the Memphis exit by 31 December 2026.
3. Rebuild trust with Tom Reyes's team: zero SEV1 incidents caused by Nimbus changes for the rest of FY27.
4. Convert at least one growth opportunity by Q4 FY27.
