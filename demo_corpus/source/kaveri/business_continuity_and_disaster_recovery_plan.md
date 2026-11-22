---
title: Business Continuity and Disaster Recovery Plan
access: Operations
format: docx
doc_no: KCA/OPS/POL-022
version: 3.0
effective: 01 April 2026
review: 31 March 2027
classification: Confidential
department: Operations
prepared_by: Mohit Arora, Head of Operations
approved_by: Varun Pillai, Chief Risk Officer
stamp: APPROVED
---
# Business Continuity and Disaster Recovery Plan

## 1. Purpose

1.1 This plan sets out how Kaveri Capital keeps its critical services running, or restores them quickly, when an office, a system or a key supplier is unavailable. Critical services are those where a failure would harm investors, breach a SEBI timeline or cause a market loss: NAV computation, trade execution and settlement, redemption payouts, and investor servicing.

1.2 The plan is owned by the Chief Risk Officer, Varun Pillai, and maintained by the Head of Operations, Mohit Arora. Technology recovery is run by the Chief Information Security Officer, Karthik Subramanian. It is reviewed annually and after every real invocation.

## 2. Sites

| Site | Role in normal times | Role in a disruption |
|---|---|---|
| Bengaluru head office (MG Road) | Primary site for Investments, Research, Operations, Fund Accounting, Risk, Compliance, Finance, Technology | — |
| Pune (Baner) – DR site | Retail distribution branch; hosts the disaster recovery data centre and 20 standby seats | **Takes over Operations, Fund Accounting and Technology if Bengaluru HQ is down** |
| Mumbai (BKC) | Dealing desk, institutional sales, PMS relationship managers | **Takes over fund management and dealing decisions; CIO and fund managers relocate here** |
| Chennai (Anna Salai) | Investor service centre | Backup for investor call centre and complaints |
| New Delhi (Connaught Place) | Distribution and PMS sales | Work-from-home fallback only |

2.1 If Bengaluru HQ is unavailable, **Operations and Fund Accounting move to the Pune DR site**, and **investment decision-making moves to Mumbai BKC**, where the dealing desk already sits. Staff not on the critical roster work from home.

2.2 The primary data centre is a co-located facility in Bengaluru. Data is replicated to the Pune DR data centre continuously for the fund accounting and RTA interface systems, and every 15 minutes for email and the document store.

## 3. Critical processes and recovery targets

| # | Process | Owner | Recovery time objective (RTO) | Recovery point objective (RPO) |
|---|---|---|---|---|
| 1 | Trade execution (dealing) | Head of Dealing | 30 minutes | Zero (order management system replicated) |
| 2 | NAV computation and publication | Fund Accounting Lead | 4 hours (must still meet the 11:00 pm deadline) | 15 minutes |
| 3 | Trade settlement with custodian | Trade Settlement team | 4 hours | 15 minutes |
| 4 | Redemption payouts | Head of Operations | 1 business day (within the 3-working-day SEBI timeline) | 15 minutes |
| 5 | Investor call centre and complaints | Head – Client Services | 4 hours (calls rerouted to Chennai) | Not applicable |
| 6 | Risk limit monitoring | CRO | 1 business day | 1 day |
| 7 | Regulatory reporting | CCO | 2 business days | 1 day |
| 8 | Payroll and vendor payments | CFO | 5 business days | 1 day |

3.1 RTO is measured from the time the BCP is invoked, not from the start of the incident.

## 4. Invoking the plan

4.1 The BCP may be invoked by any one of: the MD & CEO, the Chief Risk Officer, or the Head of Operations. If none can be reached within 30 minutes, the senior-most member of the Crisis Management Team present may invoke it.

4.2 Triggers include: loss of the Bengaluru office for more than 2 hours during market hours; failure of the primary data centre; a cyber incident that requires isolating core systems; a city-wide event (flood, curfew, power failure) that stops more than 50% of critical staff reaching the office.

### 4.3 Crisis Management Team (CMT)

| Member | Role in CMT |
|---|---|
| Ramesh Iyengar, MD & CEO | Chair; external and regulator communication |
| Varun Pillai, CRO | Plan owner; coordinates recovery |
| Mohit Arora, Head of Operations | Operations, NAV and settlement recovery |
| Karthik Subramanian, CISO | Technology and cyber recovery |
| Ashok Venkataraman, CIO (Equity) | Investment and dealing continuity |
| Shalini Kapoor, CCO | Regulatory notifications to SEBI and exchanges |
| Deepa Nambiar, Head of HR | Staff safety and welfare |

## 5. Call tree

5.1 The call tree is run from the HR emergency notification tool (SMS and voice). Each level must confirm receipt within 15 minutes.

| Level | Who calls | Who is called |
|---|---|---|
| 1 | Person invoking BCP | All CMT members |
| 2 | Each CMT member | Their direct reports (function heads and leads) |
| 3 | Function heads and leads | All staff in their teams |
| 4 | HR | Anyone not confirmed after 60 minutes |

5.2 The target is **90% of staff accounted for within 2 hours** of invocation. Contact details are refreshed every quarter by HR.

## 6. Technology recovery

| System | Primary | DR | Switch-over |
|---|---|---|---|
| Order management system | Bengaluru DC | Pune DR (hot standby) | Automatic |
| Fund accounting system | Bengaluru DC | Pune DR (warm standby) | Manual, 60 minutes |
| RTA interface | Bengaluru DC | Pune DR | Manual, 60 minutes |
| Email and collaboration | Cloud (India region) | Secondary India region | Automatic |
| Client portal and website | Cloud (India region) | Secondary India region | Automatic |

6.1 Of the FY2026-27 technology budget of ₹14 crore, ₹1.8 crore is allocated to DR infrastructure, replication and the annual BCP audit.

## 7. Key suppliers

| Supplier type | Continuity requirement |
|---|---|
| Custodian | Must have its own tested DR site; annual BCP certificate submitted to Kaveri |
| Registrar and transfer agent | Annual BCP certificate; must support switch to Kaveri Pune DR within 60 minutes |
| Valuation agencies | Two agencies used; if one fails, the other's price is used and recorded |
| Brokers | At least 3 empanelled brokers with direct connectivity from both Mumbai and Pune |

## 8. Testing

| Test | Frequency | Last done | Next due |
|---|---|---|---|
| Full DR drill (NAV computed from Pune DR site) | **Twice a year** (February and November) | 14 February 2026: NAV in 3 hours 10 minutes against a 4-hour target | 30 November 2026 |
| Call tree test | Quarterly | 10 March 2026: 93% of staff reached in 2 hours | June 2026 |
| Dealing switch to Mumbai backup terminals | Twice a year | 14 February 2026 | 30 November 2026 |
| Crisis Management Team table-top exercise (cyber scenario) | Annually | 22 January 2026 | January 2027 |
| Supplier BCP certificates | Annually | April 2026 | April 2027 |

8.1 Results of every test are reported to the Board Risk Committee in the next quarterly report. Any test that misses its RTO is treated as an operational incident and needs a remediation plan within 30 days.

## 9. Regulatory notifications

9.1 If the BCP is invoked during market hours, the CCO informs SEBI and the stock exchanges as required and records the time of notification. A post-incident report is submitted to the Board Risk Committee within 15 days.

## 10. Staff duties

- Every critical-roster employee keeps a company laptop at home overnight and can reach Pune or Mumbai within 4 hours.
- Staff must keep their mobile number current in the HR portal.
- No employee speaks to the media about an incident; all external communication goes through the MD & CEO.
