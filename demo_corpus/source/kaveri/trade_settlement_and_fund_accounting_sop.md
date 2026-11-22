---
title: Trade Settlement and Fund Accounting SOP
access: Operations
format: pdf
doc_no: KCA/OPS/SOP-008
version: 1.3
effective: 01 April 2026
review: 31 March 2027
classification: Confidential
department: Operations
prepared_by: Sunil Hegde, Fund Accounting Lead
approved_by: Mohit Arora, Head of Operations
stamp: APPROVED
---
# Trade Settlement and Fund Accounting SOP

## 1. Purpose and scope

1.1 This SOP sets out the daily steps the Operations team follows from the moment a trade is executed by the dealing desk until it is settled, booked in the scheme accounts and reflected in a signed-off NAV. It covers the five mutual-fund-style schemes (Bluechip, Flexi Cap, Small Cap Opportunities, Short Duration and Arbitrage), the Kaveri Focused Equity PMS and the Kaveri Long-Short AIF III.

1.2 It works alongside the NAV Computation and Cut-off Timings page (KCA/OPS/SOP-007), which is the reference for cut-off times and the NAV publication timetable. Where the two differ, the NAV page prevails for investor-facing timings.

1.3 Owner: Mohit Arora, Head of Operations. Day-to-day owner: Sunil Hegde, Fund Accounting Lead.

## 2. Roles

| Role | Responsibility |
|---|---|
| Dealing desk (Mumbai BKC) | Executes orders; sends the end-of-day trade file by 3:45 pm |
| Trade Settlement team (Bengaluru) | Matches trades with broker contract notes; issues settlement instructions to the custodian |
| Fund Accounting – maker | Books trades, corporate actions and accruals; computes NAV |
| Fund Accounting – checker | Independently checks and signs off the NAV |
| Fund Accounting Lead | Approves breaks over threshold; second sign-off on material items |
| Registrar and transfer agent (RTA) | Processes investor applications and unit capital |
| Custodian | Settles securities and funds with the clearing corporations |

2.1 The maker and the checker for a scheme on a given day must be different people. No one may check their own work, and the checker may not be the person who booked any trade for that scheme that day.

## 3. Daily timetable

| Time | Step | Owner |
|---|---|---|
| 9:15 am | Confirm previous day's settlement status with custodian; list any failed trades | Trade Settlement |
| 9:30 am | Cash forecast for each scheme sent to fund managers (subscriptions, redemptions, settlements due) | Fund Accounting |
| 3:00 pm | Investor transaction cut-off; RTA freezes the day's applications | RTA / Operations |
| 3:45 pm | Dealing desk sends end-of-day trade file | Dealing |
| 4:30 pm | Broker contract notes received electronically | Trade Settlement |
| **6:30 pm** | **All of the day's trades matched and reconciled against contract notes** | Trade Settlement |
| 7:00 pm | Settlement instructions sent to the custodian for T+1 settlement | Trade Settlement |
| 7:30 pm | RTA unit capital file received and reconciled | Fund Accounting |
| 9:00 pm | NAV computed for all schemes and plans | Fund Accounting – maker |
| 9:30 pm | NAV checked and signed off | Fund Accounting – checker |
| 10:30 pm | NAV published on website and app (internal target) | Operations |
| 11:00 pm | Regulatory deadline for NAV publication on Kaveri and AMFI websites | Operations |

3.1 The day's trades must be reconciled by **6:30 pm**. If any trade is still unmatched at 6:30 pm, the Trade Settlement team must inform the Fund Accounting Lead and the dealer concerned at once, and the trade is booked at the dealer's confirmed price pending the contract note.

## 4. Trade settlement

4.1 Indian equities settle on a **T+1** basis. Government securities and corporate bonds settle on T+1 or T+0 as agreed on the trade ticket.

4.2 Each trade is matched on seven fields: security (ISIN), buy/sell, quantity, price, broker, trade date and settlement date. A mismatch on any field is a **trade break**.

4.3 Settlement instructions are released to the custodian only after the trade is matched. Instructions for trades above ₹50 crore need a second approval by the Fund Accounting Lead.

4.4 A failed or short delivery from a broker is reported to the dealing desk and the fund manager by 10:00 am on the settlement day. The cost of any auction or close-out caused by the broker is recovered from the broker.

## 5. Breaks and escalation

| Break type | Example | Escalation | Deadline to resolve |
|---|---|---|---|
| Price or quantity mismatch | Contract note price differs from trade file | Dealer and Fund Accounting Lead | Same day, before NAV sign-off |
| Cash break below ₹1 lakh | Bank balance differs from books | Fund Accounting Lead | 2 working days |
| Cash break ₹1 lakh or more | Unexplained difference with custodian cash | Head of Operations | Same day; reported to CRO if open next morning |
| Unit capital break | RTA units differ from fund accounting units | RTA and Fund Accounting Lead | Before NAV sign-off |
| Corporate action missed | Dividend or bonus not booked on ex-date | Fund Accounting Lead | Next NAV; NAV error rules apply |
| Failed settlement | Broker short delivery | Fund manager and dealer | Settlement day |

5.1 Any break open for more than **3 working days** is logged in the operational risk incident register and reported to the Chief Risk Officer, Varun Pillai.

5.2 A break that changes any scheme's NAV by **0.10% or more** is treated as a material NAV error under the NAV Computation page: it is corrected, affected investors are compensated, and the CCO and CRO are told the same day.

## 6. NAV sign-off

6.1 The daily NAV is signed off by the **Fund Accounting checker**, who must confirm all of the following before signing in the fund accounting system:

1. All trades for the day are matched (no open price or quantity breaks).
2. Closing prices are loaded for 100% of equity holdings; any stale price older than 1 day is flagged.
3. Debt prices are the average of the two valuation agencies, or the backup source used after 8:30 pm is recorded.
4. RTA unit capital agrees with the fund accounting unit balance.
5. Expense accrual (TER) for the day is within the approved daily rate.
6. Day-on-day NAV movement is compared with the benchmark; any scheme moving more than 1.5% differently from its benchmark is explained in writing.

6.2 On days with a material item (a break over ₹1 lakh, a stale price, or a movement exception) the Fund Accounting Lead gives a **second sign-off** before publication.

6.3 If the NAV has not been signed off by **10:15 pm**, the checker must call the Head of Operations.

## 7. Registrar reconciliation

7.1 Every business day by 7:30 pm the RTA sends the unit capital file. Fund Accounting reconciles units, subscriptions and redemptions by scheme and plan.

7.2 Every month, by the 5th working day, a full reconciliation of investor folios held by the RTA against scheme unit capital is completed and signed by the Fund Accounting Lead.

7.3 Every quarter, Internal Audit tests a sample of 25 reconciliations.

## 8. PMS and AIF

8.1 PMS trades are allocated to client accounts under the pre-trade allocation sheet; block trades are allocated pro rata before 4:30 pm on trade date. Client portfolios are valued daily and shown on the client portal by 9:00 am next day.

8.2 The AIF NAV is computed monthly on the last business day and published to investors within 7 working days.

## 9. Month-end and records

| Item | Deadline | Owner |
|---|---|---|
| Custodian holding reconciliation (all schemes) | 3rd working day | Trade Settlement |
| Bank reconciliation (all scheme accounts) | 3rd working day | Fund Accounting |
| Month-end NAV pack to CFO and CRO | 5th working day | Fund Accounting Lead |
| Archival of signed NAV checklists | Kept 8 years | Operations |

## 10. Business continuity

If Bengaluru is unavailable, Fund Accounting switches to the Pune disaster recovery site under the Business Continuity and Disaster Recovery Plan. Two Fund Accounting staff are rostered at Pune on each NAV day.
