---
title: Crestline Insurance – Data Platform SOW Summary
access: Engineering
format: docx
doc_no: NIM/DEL/RPT-005
version: 2.0
effective: 01 July 2025
review: 30 June 2026
classification: Confidential
department: Delivery – Data & AI
prepared_by: Mohit Agarwal, Delivery Manager – Crestline Insurance
approved_by: Kavya Reddy, VP Delivery
stamp: APPROVED
---
# Crestline Insurance – Data Platform SOW Summary

This is an internal summary of Statement of Work **SOW-CRL-001** (Phase 1) under the Master Services Agreement between Nimbus Infotech and Crestline Insurance Group dated 12 June 2025. It is intended for the delivery team and does not replace the signed SOW. Where they differ, the signed SOW prevails.

## 1. Parties and key dates

| Item | Detail |
|---|---|
| Client | Crestline Insurance Group, Hartford, Connecticut, USA |
| Line of business | Property & casualty and specialty commercial insurance |
| SOW reference | SOW-CRL-001 – Enterprise Data Platform, Phase 1 |
| Signed | 20 June 2025 |
| Term | 1 July 2025 – 30 June 2026 (12 months) |
| Contract type | Fixed fee with milestone payments |
| Fee | USD 2.6 million |
| Nimbus service line | Data & AI |
| Client sponsor | Ellen Whitaker, Chief Data Officer |
| Client project lead | Marcus Greene, Director of Data Engineering |
| Nimbus account lead | Arjun Nair, VP Sales, North America |
| Nimbus delivery manager | Mohit Agarwal |

## 2. Objective

Replace Crestline's on-premises Teradata data warehouse (approx. 48 TB, end of support in 2026) with a cloud lakehouse on Azure Databricks, and deliver a governed, trusted data foundation for policy, claims and billing reporting.

## 3. Scope of work

### 3.1 In scope

1. **Platform build:** Azure landing zone for data (3 subscriptions: dev, test, prod), Databricks workspaces with Unity Catalog, Azure Data Lake Storage Gen2, Terraform automation.
2. **Ingestion:** 26 source systems, including the policy administration system, claims system, billing, CRM and 3 broker portals; batch (daily) and change data capture (near real time) for claims.
3. **Data model:** medallion architecture (bronze/silver/gold); gold-layer subject areas for Policy, Claims, Billing, Customer and Agent/Broker.
4. **Migration:** 1,850 Teradata tables, 640 BTEQ scripts and 210 reports to Databricks SQL and Power BI.
5. **Data quality and governance:** quality rules for critical data elements (approx. 400 rules), lineage, role-based access, PII masking for policyholder data.
6. **Knowledge transfer** to 12 Crestline data engineers over the final 8 weeks.

### 3.2 Out of scope

- Machine learning models and advanced analytics (proposed for Phase 2).
- Decommissioning of Teradata hardware.
- Azure and Databricks consumption costs (paid directly by Crestline).
- Changes to source systems.

## 4. Deliverables and milestones

| # | Milestone | Acceptance criteria | Planned date | Payment (USD) | Status |
|---|---|---|---|---|---|
| M1 | Mobilisation and architecture sign-off | Architecture document approved by Crestline CDO | 15 Aug 2025 | 260,000 (10%) | Accepted |
| M2 | Platform live in production | Terraform-deployed prod, security review passed | 30 Sep 2025 | 390,000 (15%) | Accepted |
| M3 | Ingestion complete for 26 sources | Daily loads running 10 consecutive days without failure | 15 Jan 2026 | 520,000 (20%) | Accepted (8 days late) |
| M4 | Gold layer and report migration | 210 reports reconciled within 0.5% of Teradata results | 31 Mar 2026 | 650,000 (25%) | Accepted |
| M5 | Parallel run and cutover | 4 weeks parallel run; Teradata switched to read-only | 29 May 2026 | 520,000 (20%) | Accepted |
| M6 | Knowledge transfer and closure | KT sign-off; hypercare complete | 30 Jun 2026 | 260,000 (10%) | Accepted |
| | **Total** | | | **2,600,000** | |

Acceptance: Crestline has **10 business days** to accept or reject a deliverable with written reasons; silence counts as acceptance.

## 5. Team

| Role | FTE | Location |
|---|---|---|
| Engagement lead / solution architect | 2 | Hartford (onshore) |
| Data architects | 2 | Bengaluru |
| Data engineers | 16 | Bengaluru, Hyderabad |
| BI developers (Power BI) | 4 | Hyderabad |
| QA and data reconciliation | 3 | Bengaluru |
| Project manager | 1 | Bengaluru |
| **Total** | **28** | |

Key personnel (engagement lead, lead data architect) cannot be replaced without 30 days' notice and client consent.

## 6. Service levels during the term

| Measure | Target |
|---|---|
| Daily batch completion | By 06:00 ET on 98% of business days |
| Production defect response (Severity 1) | 1 hour, 24x7 during parallel run |
| Data quality rule pass rate (critical data elements) | ≥ 99% |

Service levels are reported monthly; there are no service credits in Phase 1.

## 7. Commercial terms

- Fixed fee of **USD 2.6 million**, invoiced on milestone acceptance, net 30 days.
- Travel and expenses billed at actuals, capped at **USD 85,000** for the term.
- Change requests at the North America rate card (blended offshore USD 38/hour, onshore USD 145/hour for data roles), approved in writing by the client sponsor.
- Warranty: 60 days after M6 for defects against acceptance criteria.
- Liability cap: fees paid in the preceding 12 months.

## 8. Change requests to date

| CR | Description | Value (USD) | Status |
|---|---|---|---|
| CR-CRL-003 | Add 2 broker portals as sources | 64,000 | Approved |
| CR-CRL-005 | Extend parallel run by 2 weeks (client request) | 48,500 | Approved |
| CR-CRL-007 | Power BI row-level security for 140 agencies | 37,200 | Approved |

Total approved change requests: USD 149,700. Total Phase 1 value including CRs: USD 2,749,700.

## 9. Outcome and next steps

Phase 1 closed on 30 June 2026 with all milestones accepted. Teradata is read-only and scheduled for decommissioning by Crestline in December 2026. Crestline reported a 38% reduction in report run times and nightly batch completion moved from 07:40 ET to 04:55 ET on average. A Phase 2 proposal (claims analytics and fraud detection) is being prepared by Sales; see the Sales Proposals collection.
