---
title: Harbor Logistics – Cloud Migration Status Report Q1 FY27
access: Engineering
format: pdf
doc_no: NIM/DEL/RPT-002
version: 1.0
effective: 10 July 2026
review: 10 October 2026
classification: Confidential
department: Delivery – North America
prepared_by: Karthik Subramanian, Delivery Manager – Harbor Logistics
approved_by: Kavya Reddy, VP Delivery
stamp: APPROVED
---
# Harbor Logistics – Cloud Migration Status Report Q1 FY27

Reporting period: 1 April 2026 to 30 June 2026. Prepared for the Harbor Logistics steering committee meeting of 15 July 2026.

## 1. Executive summary

Overall status: **AMBER**.

The migration factory completed waves 8 and 9 in the quarter, moving **74 applications** to AWS and bringing the total to **287 of 412 applications (70%)**. Cost and quality metrics are on track. Status is Amber because of the HarborTrack outage during the wave 9 cutover on 11 June 2026 (INC-2291) and a schedule risk on the mainframe-dependent applications in waves 13–14. The Memphis data centre exit date of 31 December 2026 is unchanged but now has only 9 days of float.

| Dimension | Status | Comment |
|---|---|---|
| Schedule | Amber | Waves 8–9 on time; waves 13–14 at risk (mainframe) |
| Budget | Green | 2.1% under plan year to date |
| Quality | Amber | One SEV1 (INC-2291); rollback rate 3.4% |
| Scope | Green | 2 applications added, 3 retired by change request |
| People | Amber | Bengaluru NOC attrition |

## 2. Progress by wave

| Wave | Applications | Planned cutover | Actual cutover | Status |
|---|---|---|---|---|
| 1–7 | 213 | Oct 2023 – Mar 2026 | As planned | Complete |
| 8 | 38 | 16 May 2026 | 16 May 2026 | Complete |
| 9 | 36 | 6–13 June 2026 | 13 June 2026 (one app moved after INC-2291) | Complete |
| 10 | 31 | 22 August 2026 | — | In preparation |
| 11 | 29 | 26 September 2026 | — | Discovery complete |
| 12 | 27 | 31 October 2026 | — | Discovery in progress |
| 13 | 22 | 21 November 2026 | — | At risk (mainframe) |
| 14 | 16 | 12 December 2026 | — | At risk (mainframe) |
| **Total** | **412** | | **287 migrated** | |

Disposition of the 287 migrated applications: 171 rehosted, 89 replatformed, 15 refactored, 12 retired.

## 3. Key metrics

| Metric | Target | Q1 FY27 actual | Q4 FY26 actual |
|---|---|---|---|
| Applications migrated in quarter | 72 | 74 | 61 |
| Cutover rollback rate | < 5% | 3.4% | 4.9% |
| Post-cutover P1 incidents (first 14 days) | 0 | 1 | 0 |
| Average cutover downtime per app | < 4 h | 2.6 h | 3.1 h |
| On-prem servers decommissioned (cumulative) | 1,100 | 1,140 | 960 |
| AWS monthly run cost (migrated estate) | ≤ USD 610,000 | USD 587,400 | USD 512,800 |
| Savings Plan coverage | ≥ 65% | 68% | 61% |

## 4. Financials (Nimbus billing for the quarter)

| Component | Planned (USD) | Billed (USD) | Variance |
|---|---|---|---|
| Migration waves 8–9 (fixed price) | 412,500 | 412,500 | 0 |
| Managed cloud operations (3 × 112,500) | 337,500 | 337,500 | 0 |
| Service credit INC-2291 | 0 | (17,500) | −17,500 |
| Application support (T&M, capped) | 210,000 | 191,240 | −18,760 |
| Landing zone and FinOps | 90,000 | 90,000 | 0 |
| **Total** | **1,050,000** | **1,013,740** | **−36,260** |

## 5. INC-2291 summary

On 11 June 2026 the HarborTrack warehouse management system was unavailable for **2 hours 47 minutes** after a Terraform change made during the wave 9 cutover removed database access for the application tier. Thirty-eight distribution centres could not release outbound shipments. A service credit of **USD 17,500** (5% of the monthly managed services fee) was issued under the MSA. The full post-mortem is document NIM/DEL/RPT-006. Seven corrective actions were agreed; five are closed and two are due by 31 July 2026.

## 6. Risks and issues

| ID | Description | Probability | Impact | Mitigation | Owner | Due |
|---|---|---|---|---|---|---|
| R-31 | Mainframe-dependent apps (11) need middleware not yet supported on AWS | High | High | Assess AWS Mainframe Modernization replatform vs. co-location of remaining LPAR | Daniel Brooks | 15 Aug 2026 |
| R-34 | Harbor change freeze for peak season (15 Nov – 5 Jan) overlaps waves 13–14 | Medium | High | Request freeze exception for non-warehouse apps; pull wave 13 forward by 2 weeks | Karthik Subramanian | 31 Jul 2026 |
| R-35 | Bengaluru NOC attrition (22% annualised) | Medium | Medium | Retention bonuses; 4 backfills hired, joining in August | Karthik Subramanian | 31 Aug 2026 |
| I-12 | Harbor network team capacity for firewall changes (avg 6 days per request) | — | Medium | Pre-approved firewall rule templates agreed for wave 10 | Tom Reyes (Harbor) | 22 Aug 2026 |

## 7. Decisions requested from the steering committee

1. Approve the change request CR-HL-047 to add a pre-cutover connectivity verification gate to every wave (no cost; adds 4 hours per wave).
2. Decide between replatforming or co-locating the 11 mainframe-dependent applications by **15 August 2026**.
3. Approve the freeze exception request for waves 13–14 (R-34).

## 8. Plan for Q2 FY27 (July – September 2026)

- Complete wave 10 (31 applications) on 22 August 2026 and wave 11 (29 applications) on 26 September 2026.
- Close remaining INC-2291 actions by 31 July 2026.
- Deliver the mainframe options paper on 1 August 2026.
- Support the renewal process ahead of the 30 September 2026 term end; Nimbus delivery will present a three-year operations roadmap at the July QBR.
