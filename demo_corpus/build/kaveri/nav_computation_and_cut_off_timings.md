# NAV Computation and Cut-off Timings

| Document No. | Version | Effective | Department | Classification | Approved by |
|---|---|---|---|---|---|
| KCA/OPS/SOP-007 | 2.4 | 01 April 2026 | Operations | Internal | Ramesh Iyengar, Managing Director & CEO |

Operations wiki page. Everyone at Kaveri gets asked "which NAV will I get?" by friends, family and clients. This page gives the answer, and explains how the Fund Accounting team strikes the NAV every business day. Owner: Mohit Arora, Head of Operations.

## 1. Quick answer: which NAV applies?

For all Kaveri mutual-fund-style schemes (Bluechip, Flexi Cap, Small Cap Opportunities, Short Duration, Arbitrage):

| Transaction | Received by Kaveri before 3:00 pm | Received at or after 3:00 pm |
|---|---|---|
| Purchase / SIP / switch-in | Same day's NAV, **if funds are realised** in the scheme's bank account before 3:00 pm | Next business day's NAV (subject to funds realised) |
| Redemption / switch-out | Same day's NAV | Next business day's NAV |

- **Cut-off time is 3:00 pm** on business days, for both equity and debt schemes.
- For purchases, what matters is when the **money reaches the scheme's account**, not when the investor clicked "invest". A purchase submitted at 11:00 am but with funds credited at 3:20 pm gets the next business day's NAV.
- The time stamp is the one recorded by the registrar's system or the Kaveri website/app server, not the investor's phone clock.
- A "business day" excludes Saturdays, Sundays and stock-exchange or bank holidays in Mumbai.

## 2. Payout timelines

| Item | Timeline |
|---|---|
| Redemption proceeds – all schemes | Within 3 working days of the redemption date (Kaveri's internal target: 2 working days for Arbitrage and Short Duration) |
| Dividend (IDCW) payout | Within 7 working days of the record date |
| Delay compensation | Interest at 15% per annum paid to the investor for each day of delay beyond the regulatory timeline |

## 3. Exit loads (reminder)

- Equity schemes (Bluechip, Flexi Cap, Small Cap Opportunities): **1% if redeemed within 365 days** of allotment.
- Short Duration: nil. Arbitrage: 0.25% if redeemed within 15 days.
- Exit load is deducted from the NAV, so the investor receives "NAV minus load".

## 4. Daily NAV timetable

| Time | Step | Team |
|---|---|---|
| 3:00 pm | Transaction cut-off; registrar freezes the day's applications | Registrar / Operations |
| 3:30 pm | Equity market close; trade files from dealing desk | Dealing |
| 4:00 pm | Exchange closing prices loaded for all equity holdings | Fund Accounting |
| 5:30 pm | Trades, corporate actions and expense accruals booked | Fund Accounting |
| 7:30 pm | Debt security prices received from the valuation agencies | Fund Accounting |
| 8:30 pm | If debt prices not received, switch to backup valuation source | Fund Accounting |
| 9:00 pm | NAV computed for all schemes and plans | Fund Accounting (maker) |
| 9:30 pm | Independent NAV check and sign-off | Fund Accounting (checker) |
| 10:30 pm | NAV published on Kaveri website and app (internal target) | Operations |
| 11:00 pm | **Regulatory deadline** to publish NAV on the Kaveri and AMFI websites | Operations |

If the 9:30 pm sign-off has not happened by 10:15 pm, the NAV checker must call the Head of Operations.

## 5. How the NAV is computed

**NAV per unit = (Market value of investments + cash and receivables − liabilities − accrued expenses) ÷ Units outstanding**

- Equity shares are valued at the closing price on the principal stock exchange (NSE; BSE if not traded on NSE).
- Debt securities are valued at the average of prices supplied by the two independent valuation agencies.
- Expenses (TER) are accrued daily, including for holidays.
- NAV is computed separately for the direct plan and the regular plan; the direct plan NAV is higher because it has a lower expense ratio.
- NAV is rounded to **4 decimal places**.

## 6. NAV errors

| Error size (as % of NAV) | What happens |
|---|---|
| Below 0.10% | Corrected in the next NAV; logged as an operational incident |
| 0.10% or more (material) | Corrected; investors who transacted at the wrong NAV are compensated by Kaveri; reported to the CCO and CRO the same day |

In FY2025-26 there were no NAV errors at or above the 0.10% materiality level. There was one late publication: on 14 August 2025 the NAV was published at 11:42 pm because a debt price file arrived late. That is why the 8:30 pm backup-price rule above now exists.

## 7. Business continuity

- NAV can be computed from the **Pune disaster recovery (DR) site** if Bengaluru is unavailable.
- The DR target is to compute NAV within 4 hours of switching to Pune. The last DR test (14 February 2026) did it in 3 hours 10 minutes.
- Two Fund Accounting staff are rostered at Pune on each NAV day for cover.

## 8. PMS and AIF (different rules)

- **PMS (Kaveri Focused Equity PMS)** has no NAV cut-off. Each client portfolio is valued daily at closing prices and shown on the client portal by 9:00 am next day. Additions and withdrawals are processed within 2 working days of funds or instructions being received.
- **Kaveri Long-Short AIF III** computes NAV monthly (last business day of the month) and publishes it to investors within 7 working days. Redemptions are monthly, with 30 days' notice.

## 9. FAQ

**A client sent money by NEFT at 2:45 pm but the bank credited it at 3:05 pm. Which NAV?** Next business day's NAV, because funds were realised after cut-off.

**A redemption request came in on Saturday. Which NAV?** Monday's NAV (or the next business day if Monday is a holiday).

**Who can approve an exception to cut-off?** No one. Cut-off rules are regulatory and Kaveri does not grant exceptions.

**Where do I report a suspected wrong NAV?** Email the Fund Accounting lead and the Head of Operations immediately; do not discuss with the client until Operations confirms.
