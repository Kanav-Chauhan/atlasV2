---
title: Zenith Retail – SAP S/4HANA Project Charter
access: Engineering
format: pdf
doc_no: NIM/DEL/RPT-003
version: 1.2
effective: 05 January 2026
review: 30 June 2027
classification: Confidential
department: Delivery – Enterprise Apps
prepared_by: Ananya Pillai, Project Manager – Zenith S/4HANA
approved_by: Kavya Reddy, VP Delivery
stamp: APPROVED
---
# Zenith Retail – SAP S/4HANA Project Charter

Project name: **Project Udaan** – Zenith Retail SAP S/4HANA transformation.

## 1. Background

Zenith Retail Ltd. is an Indian apparel and home-furnishings retailer headquartered in Mumbai, operating **480 stores** in 96 cities, 6 regional distribution centres, and an e-commerce channel. Zenith runs SAP ECC 6.0 (EHP 7), installed in 2011, whose mainstream maintenance ends in 2027. Month-end close takes 9 working days, stock visibility across stores is refreshed only overnight, and GST reconciliation requires heavy manual work.

Zenith selected Nimbus Infotech after an RFP in October 2025 to implement SAP S/4HANA 2023 (private cloud edition) using a selective data transition approach.

## 2. Objectives and success measures

| # | Objective | Measure | Target |
|---|---|---|---|
| 1 | Faster financial close | Working days to close the month | From 9 to 4 |
| 2 | Real-time inventory visibility | Store stock refresh latency | From overnight to < 15 min |
| 3 | Lower inventory carrying cost | Inventory days | Reduce by 8 days within 12 months of go-live |
| 4 | Automated GST compliance | Manual GST reconciliation effort | Reduce by 70% |
| 5 | Stable go-live | P1 incidents in first 30 days of hypercare | ≤ 5 |

## 3. Scope

### 3.1 In scope

- Modules: Finance (GL, AP, AR, Asset Accounting, Cash Management), Controlling, Materials Management, Sales and Distribution, SAP Retail (Merchandise Management, Allocation), Extended Warehouse Management for 6 DCs, and SAP Analytics Cloud dashboards.
- Integrations (34 interfaces): POS system in 480 stores, e-commerce platform, 3 logistics partners, bank host-to-host (2 banks), GST e-invoicing and e-way bill via a GSP, HR payroll system.
- Data migration: open items, 5 years of financial history (summarised), article master (~2.4 lakh articles), vendor and customer masters.
- Training: train-the-trainer for 120 key users; e-learning for ~3,500 end users.
- Hypercare: 3 months after go-live.

### 3.2 Out of scope

- Replacement of the store POS application.
- HR and payroll (remains on the current system; interface only).
- Hardware and SAP licences (procured by Zenith directly).

## 4. Timeline (SAP Activate)

| Phase | Start | End | Key milestone |
|---|---|---|---|
| Prepare | 05 January 2026 | 27 February 2026 | Project kick-off, plan baselined |
| Explore | 02 March 2026 | 29 May 2026 | Fit-to-standard workshops complete; design sign-off |
| Realize | 01 June 2026 | 27 November 2026 | Build complete; SIT cycles 1–2; UAT |
| Deploy | 30 November 2026 | 31 March 2027 | 3 mock cutovers, dress rehearsal, end-user training |
| **Go-live** | **01 April 2027** | | Aligned to the start of FY2027-28 |
| Hypercare | 01 April 2027 | 30 June 2027 | Stabilisation; handover to AMS |

Go-live on the first day of the financial year avoids a mid-year ledger migration.

## 5. Commercials

The engagement is fixed price at **₹38 crore** (excluding GST), with milestone-based payments.

| Milestone | % | Amount (₹ crore) | Planned date |
|---|---|---|---|
| M1 – Kick-off and project plan approved | 10% | 3.80 | February 2026 |
| M2 – Design (Explore) sign-off | 15% | 5.70 | May 2026 |
| M3 – Build complete and SIT 1 exit | 20% | 7.60 | September 2026 |
| M4 – UAT sign-off | 20% | 7.60 | November 2026 |
| M5 – Successful go-live | 25% | 9.50 | April 2027 |
| M6 – Hypercare exit | 10% | 3.80 | June 2027 |
| **Total** | **100%** | **38.00** | |

Change requests are priced at the Enterprise Apps rate card (blended ₹1.65 lakh per person-month offshore) and require Steering Committee approval above ₹25 lakh.

## 6. Organisation

### 6.1 Governance

| Forum | Members | Frequency |
|---|---|---|
| Steering Committee | Rajesh Malhotra (Zenith CFO, sponsor), Zenith CIO Priya Venkatesh, Kavya Reddy (Nimbus VP Delivery), Vikram Kulkarni (Nimbus CEO, quarterly) | Monthly |
| Project Management Office | Suresh Nambiar (Zenith PM), Ananya Pillai (Nimbus PM) | Weekly |
| Design Authority | Zenith process owners, Nimbus solution architect | Weekly during Explore and Realize |

### 6.2 Nimbus team

| Role | Count (peak) | Location |
|---|---|---|
| Project Manager and PMO | 3 | Mumbai (client site) |
| Solution architect | 1 | Mumbai |
| Functional consultants (FI/CO, MM, SD, Retail, EWM) | 28 | Hyderabad, client site |
| Technical (ABAP, integration, BTP) | 34 | Hyderabad, Pune |
| Data migration | 9 | Pune |
| Testing | 8 | Hyderabad |
| Change management and training | 2 | Mumbai |
| **Total at peak (Realize)** | **85** | |

Zenith commits 22 full-time process owners and key users from March 2026 to June 2027.

## 7. Assumptions and constraints

1. Zenith provisions the S/4HANA private cloud environments by 15 February 2026.
2. Fit-to-standard: custom developments (RICEFW objects) capped at **180**; more needs a change request.
3. Zenith decisions on design questions within 5 working days.
4. No store openings or system freezes planned by Zenith between 15 March and 15 April 2027 beyond normal year-end close.
5. Data cleansing is Zenith's responsibility; Nimbus provides tools and validation reports.

## 8. Key risks

| Risk | Impact | Mitigation | Owner |
|---|---|---|---|
| Key user availability during festive season (Oct–Nov 2026) clashes with UAT | High | UAT split into two windows; backup users nominated | Suresh Nambiar |
| POS interface performance with 480 stores at peak | High | Performance test at 2x Diwali-day volume during SIT 2 | Nimbus integration lead |
| Article master data quality (duplicates ~12% in sample) | Medium | Cleansing sprint in Explore; weekly quality dashboard | Zenith MDM team |
| Year-end go-live coinciding with statutory close | Medium | Dual-run of ECC close for March 2027 | Ananya Pillai |

## 9. Approval

This charter was approved by the Steering Committee on 05 January 2026. Changes to scope, milestones or price require a signed change request under the Master Services Agreement dated 18 December 2025.
