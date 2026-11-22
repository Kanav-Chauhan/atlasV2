---
title: BRD – Zenith Retail Omnichannel Inventory Sync
access: Engineering
format: docx
doc_no: NIM/DEL/PRO-001
version: 1.2
effective: 22 May 2026
review: 31 March 2027
classification: Confidential
department: Delivery – Enterprise Apps
prepared_by: Ananya Pillai, Project Manager – Zenith Retail
approved_by: Kavya Reddy, VP Delivery
stamp: APPROVED
---
# BRD – Zenith Retail Omnichannel Inventory Sync

Business requirements document for the inventory visibility stream of **Project Udaan**, the Zenith Retail SAP S/4HANA transformation. This BRD was produced in the Explore phase and is the baseline for build, testing and acceptance in the Realize and Deploy phases.

## 1. Business problem

Zenith Retail operates 480 stores in 96 cities, 6 regional distribution centres (DCs) and an e-commerce channel. Today, store stock in SAP ECC 6.0 is refreshed only once a night by a batch job that runs from 01:30 to 04:00 IST. As a result:

- The e-commerce site promises stock that has already been sold in a store, causing an average of **1,850 cancelled online orders per week** (FY2025-26 average).
- "Buy online, pick up in store" (BOPIS) is offered in only 62 metro stores because stock cannot be trusted elsewhere.
- Store staff phone nearby stores to find sizes for walk-in customers; Zenith estimates 40 minutes per store per day is spent this way.
- Inter-store transfers are planned on stock that is up to 26 hours old.

## 2. Goals and success measures

| # | Goal | Measure | Baseline | Target |
|---|---|---|---|---|
| G1 | Near-real-time stock visibility | Store stock refresh latency in S/4HANA | Overnight (up to 26 h) | **Under 15 minutes** at p95 |
| G2 | Fewer cancelled online orders | Cancellations due to stock mismatch | 1,850 per week | Below 400 per week within 3 months of go-live |
| G3 | Wider BOPIS coverage | Stores offering BOPIS | 62 | All 480 stores by end of hypercare |
| G4 | Accurate stock for allocation | Stock accuracy (cycle count vs system) | 91% | 97% or higher |
| G5 | Fewer manual stock checks | Staff time on stock calls | 40 min/store/day | 10 min/store/day |

G1 is the same target as Objective 2 of the Project Charter ("from overnight to < 15 min").

## 3. Scope

### 3.1 In scope

- Sales, returns and exchanges from the store POS in all 480 stores.
- Goods receipts, goods issues and transfers in the 6 DCs on SAP Extended Warehouse Management.
- E-commerce orders, reservations and cancellations.
- Inter-store transfers and stock adjustments (damage, shrinkage).
- A stock availability API for the e-commerce platform and the store "Find in Store" app.

### 3.2 Out of scope

- Replacement of the store POS application (as per the Project Charter).
- Marketplace channels (third-party online marketplaces) – planned for a later phase.
- Demand forecasting and automated replenishment.

## 4. Stakeholders

| Name | Organisation | Role in this BRD |
|---|---|---|
| Rajesh Malhotra | Zenith Retail, CFO | Project sponsor; final business sign-off |
| Priya Venkatesh | Zenith Retail, CIO | IT sign-off; owns POS and e-commerce systems |
| Harish Bajaj | Zenith Retail, Head of Retail Operations | Business process owner (stores) |
| Leena D'Souza | Zenith Retail, Head of E-commerce | Business process owner (online) |
| Ananya Pillai | Nimbus, Project Manager | BRD author and owner |
| Nimbus solution architect | Nimbus | Solution design and interface specification |

## 5. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Every POS sale, return and exchange is posted to S/4HANA as a stock movement within **5 minutes** of the transaction, in store-level batches of at most 200 lines. | Must |
| FR-02 | DC goods movements in EWM update available stock immediately (synchronous posting). | Must |
| FR-03 | E-commerce orders create a **soft reservation** against the fulfilling store or DC within 60 seconds; unpaid reservations expire after 30 minutes. | Must |
| FR-04 | The stock availability API returns available-to-promise quantity by article, size and store in under **300 milliseconds** at p95. | Must |
| FR-05 | The API applies a safety buffer per article category (default 2 units for apparel, 1 unit for home furnishings) before showing stock online. | Must |
| FR-06 | If a store's POS feed is delayed by more than 30 minutes, that store is automatically hidden from BOPIS and "Find in Store" until the feed recovers. | Must |
| FR-07 | Store managers see a stock exceptions dashboard in SAP Analytics Cloud, refreshed every 15 minutes. | Should |
| FR-08 | Inter-store transfer proposals use stock no older than 15 minutes. | Should |
| FR-09 | Daily reconciliation report compares POS closing stock with S/4HANA stock for each store and flags differences above 0.5%. | Must |

## 6. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | Volume: handle **2x Diwali-day peak** volume (about 3.1 million POS lines per day, 95,000 lines in the peak hour) without breaching FR-01. This is tested in SIT cycle 2, as required by the Project Charter risk register. |
| NFR-02 | Availability of the stock availability API: 99.9% per month, measured from the e-commerce platform. |
| NFR-03 | No stock movement may be lost: every POS message is stored and replayed if S/4HANA is unavailable; replay must complete within 2 hours of recovery. |
| NFR-04 | Integration runs on SAP BTP Integration Suite; the inventory interfaces are 4 of the 34 interfaces in the charter scope (INT-07 POS sales, INT-08 POS returns, INT-15 e-commerce reservations, INT-22 availability API). |
| NFR-05 | Article master volume: about 2.4 lakh articles with up to 12 sizes each. |

## 7. Assumptions and dependencies

1. Zenith upgrades POS terminals in 38 older stores to the current POS release by 31 August 2026; these stores are a dependency for FR-01.
2. Store network links of at least 4 Mbps are available in all stores; stores below this run in degraded mode under FR-06.
3. Article master cleansing (duplicates found in about 12% of the sample) completes before the first mock cutover.
4. The e-commerce platform team at Zenith builds its side of INT-15 and INT-22 by 30 September 2026.

## 8. Acceptance criteria

The inventory sync stream is accepted when all of the following are met in UAT and confirmed in the first 30 days of hypercare:

| # | Criterion | Evidence |
|---|---|---|
| AC-1 | p95 stock refresh latency under 15 minutes over 7 consecutive days, all 480 stores | SAC latency report |
| AC-2 | Peak test at 2x Diwali-day volume passed with no lost messages | SIT 2 test report |
| AC-3 | Availability API p95 under 300 ms at 500 requests per second | Performance test report |
| AC-4 | Daily reconciliation differences above 0.5% in fewer than 5 stores per day | Reconciliation report |
| AC-5 | FR-06 failover of a store demonstrated in UAT | UAT script UDN-INV-031 |

## 9. Sign-off

This BRD requires sign-off from **Rajesh Malhotra (Zenith CFO, project sponsor)** and **Priya Venkatesh (Zenith CIO)** for Zenith, and from **Kavya Reddy (VP Delivery)** for Nimbus. Version 1.2 was signed off by all three on **22 May 2026**, ahead of the Explore phase design sign-off (milestone M2). Changes after sign-off follow the change request process in the Project Charter; changes above ₹25 lakh need Steering Committee approval.

| Version | Date | Change |
|---|---|---|
| 1.0 | 24 April 2026 | First draft after fit-to-standard workshops |
| 1.1 | 12 May 2026 | Added FR-06 store hiding and FR-09 reconciliation |
| 1.2 | 22 May 2026 | Safety buffer values agreed; signed off |
