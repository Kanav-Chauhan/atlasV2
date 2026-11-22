---
title: Operational Risk Incident Log FY26
access: Compliance & Legal
format: docx
doc_no: KCA/RSK/RPT-017
version: 1.0
effective: 15 April 2026
review: 15 April 2027
classification: Confidential
department: Risk Management
prepared_by: Varun Pillai, Chief Risk Officer
approved_by: Ramesh Iyengar, Managing Director & CEO
stamp: CONFIDENTIAL
---
# Operational Risk Incident Log FY26

Period: 1 April 2025 to 31 March 2026. This log records every operational risk incident reported to the Risk team, whether or not it caused a financial loss.

## 1. Summary

| Metric | FY2024-25 | FY2025-26 |
|---|---|---|
| Incidents logged | 11 | 14 |
| Incidents with financial loss | 4 | 5 |
| Gross financial loss | ₹22.4 lakh | ₹16.9 lakh |
| Recoveries | ₹2.1 lakh | ₹2.9 lakh |
| Net loss | ₹20.3 lakh | ₹14.0 lakh |
| Regulatory reportable incidents | 1 | 1 |
| Average days to close | 19 | 16 |

1.1 Severity scale: **S1** (critical: loss above ₹25 lakh, regulatory breach or client data exposure); **S2** (major: loss ₹5–25 lakh or service failure above 4 hours); **S3** (moderate: loss below ₹5 lakh); **S4** (near miss, no loss).

1.2 Reporting rule: any employee who becomes aware of an incident must report it in the incident portal within 24 hours. S1 incidents are escalated to the MD & CEO within 2 hours.

## 2. Incident Log

| ID | Date | Area | Description | Severity | Loss (₹ lakh) | Status |
|---|---|---|---|---|---|---|
| ORI-FY26-01 | 22 Apr 2025 | Operations | Redemption of ₹14 lakh processed to an old bank mandate after a mandate-change request was keyed late | S3 | 0.0 | Closed – funds recalled |
| ORI-FY26-02 | 09 Jun 2025 | Dealing | Flexi Cap buy order for 50,000 shares keyed as 5,00,000; caught by pre-trade limit check, not executed | S4 | 0.0 | Closed |
| ORI-FY26-03 | 14 Aug 2025 | NAV | NAV for all schemes published at 11:42 pm, after the 11:00 pm deadline, due to delayed debt price file from valuation agency | S2 | 0.0 | Closed – reported to SEBI |
| ORI-FY26-04 | 02 Sep 2025 | Operations | Cut-off error: 37 redemption requests received at 3:04 pm given same-day NAV in error | S3 | 2.6 | Closed |
| ORI-FY26-05 | 19 Sep 2025 | IT / Cyber | Phishing email led one Chennai branch employee to enter credentials on a fake login page; MFA blocked access | S4 | 0.0 | Closed |
| ORI-FY26-06 | 30 Oct 2025 | PMS | PMS performance fee for 12 clients computed without applying the high-water mark | S2 | 7.9 | Closed – refunds paid |
| ORI-FY26-07 | 18 Nov 2025 | Dealing | AIF short position of 8,000 shares not covered on settlement day due to stock-lending recall; auction penalty | S3 | 1.4 | Closed |
| ORI-FY26-08 | 05 Dec 2025 | Vendor | Registrar's statement email run failed for 6 hours; 9,200 investors received account statements a day late | S3 | 0.0 | Closed |
| ORI-FY26-09 | 23 Dec 2025 | Operations | Dividend reinvestment for Arbitrage Fund processed at wrong NAV date for 410 folios | S3 | 1.2 | Closed |
| ORI-FY26-10 | 07 Jan 2026 | IT | Risk system VaR batch failed overnight; daily limit monitor issued at 1:15 pm instead of 10:00 am | S4 | 0.0 | Closed |
| ORI-FY26-11 | 29 Jan 2026 | Compliance | Two research analysts traded in personal accounts before pre-clearance was granted; reported to CCO within 1 working day | S3 | 0.0 | Closed – disciplinary action |
| ORI-FY26-12 | 17 Feb 2026 | Physical | Water leak at Mumbai (BKC) branch server room; local file server down for 9 hours | S2 | 3.8 | Closed – insurance claim filed |
| ORI-FY26-13 | 11 Mar 2026 | Operations | SIP debit instruction presented twice for 63 investors by sponsor bank; reversed within 2 days | S4 | 0.0 | Closed |
| ORI-FY26-14 | 27 Mar 2026 | Vendor | Custodian delayed corporate action credit (bonus shares) in Small Cap; NAV unaffected after manual accrual | S4 | 0.0 | Closed |

2.1 Total gross loss: ₹2.6 + 7.9 + 1.4 + 1.2 + 3.8 = **₹16.9 lakh** across 5 incidents.

## 3. Incidents by Quarter

| Quarter | Incidents | With loss | Gross loss (₹ lakh) |
|---|---|---|---|
| Q1 (Apr–Jun 2025) | 2 | 0 | 0.0 |
| Q2 (Jul–Sep 2025) | 3 | 1 | 2.6 |
| Q3 (Oct–Dec 2025) | 4 | 3 | 10.5 |
| Q4 (Jan–Mar 2026) | 5 | 1 | 3.8 |

3.1 Note: the Q4 FY26 Risk Dashboard reported 4 incidents for Q4. ORI-FY26-14 was logged on 2 April 2026 (after the dashboard cut-off) but relates to an event on 27 March 2026, so it is included here.

## 4. Root-Cause Themes

| Theme | Incidents | Action |
|---|---|---|
| Manual keying and late processing | 01, 04, 09 | Straight-through processing for mandate changes and dividend options; go-live 31 July 2026 |
| Vendor dependency | 03, 08, 14 | Service-level penalties added to valuation agency and registrar contracts; backup price source for debt |
| Fee computation | 06 | PMS fee engine now enforces the high-water mark automatically; four-eyes check on every performance fee |
| Personal trading controls | 11 | Pre-clearance hard-block in the broker feed; PIT refresher training for Research |

## 5. Significant Incidents

5.1 **ORI-FY26-03 (NAV delay).** The valuation agency's debt price file arrived at 10:55 pm instead of the usual 7:30 pm. NAV was published at 11:42 pm. The delay was reported to SEBI as required. Fix: a backup valuation source is now contracted, and if the primary file has not arrived by 8:30 pm, Operations switches to the backup.

5.2 **ORI-FY26-06 (PMS performance fee).** Performance fees for 12 PMS clients on the 1.0% + 20% profit share plan were charged on gains that only recovered earlier losses, i.e. without applying the high-water mark. Total over-charge ₹7.9 lakh, refunded with interest by 28 November 2025. Detected by a client query.

5.3 **ORI-FY26-12 (Mumbai water leak).** Losses of ₹3.8 lakh for equipment; insurance recovery of ₹2.9 lakh received in March 2026.

## 6. Sign-off

Log reviewed by the Operational Risk Committee on 15 April 2026 and presented to the Board Risk Committee with the Q4 FY26 report.
