---
title: On-Call Policy and Rotation
access: Engineering
format: pdf
doc_no: NIM/ENG/POL-001
version: 2.0
effective: 01 April 2026
review: 31 March 2027
classification: Internal
department: Infrastructure & SRE
prepared_by: Pradeep Joshi, Head of Infrastructure & SRE
approved_by: Meera Iyer, Chief Technology Officer
stamp: APPROVED
---
# On-Call Policy and Rotation

## 1. Purpose

NimbusOps and our managed-services platforms run 24x7. This policy sets out who is on call, what is expected of them, how rotations are built, and how on-call work is compensated, so that coverage is reliable and the load is fair.

## 2. Applicability

Applies to all engineers in grades L2 to L5 in the SRE, NimbusOps Engineering and Platform Engineering teams who have completed on-call onboarding. L1 Trainees are never placed on call. L6 and above join the Incident Commander rota only. Participation for other teams (e.g. client delivery squads with contractual 24x7 support) follows the same rules unless the client contract says otherwise.

## 3. Rotation structure

| Rotation | Coverage | Shift length | Handover |
|---|---|---|---|
| NimbusOps Primary | 24x7 | 7 days | Monday 10:00 IST |
| NimbusOps Secondary | 24x7 | 7 days | Monday 10:00 IST |
| Platform/SRE | 24x7 | 7 days | Monday 10:00 IST |
| Incident Commander | 24x7 | 7 days | Monday 10:00 IST |
| Database SME | Best effort, escalation only | 14 days | Monday 10:00 IST |

Rules:

1. A rotation must have at least **6 engineers**, so nobody is primary more than one week in six.
2. No engineer may be on call for more than **one week in four** across all rotations combined.
3. Primary and secondary must not be the same person, and should be in different cities (Pune, Bengaluru, Hyderabad) where possible.
4. Rotations are built in PagerDuty six weeks ahead by the team's Engineering Manager.
5. Swaps are allowed if recorded in PagerDuty at least 24 hours in advance; same-day swaps need the manager's approval in `#oncall`.

## 4. Expectations while on call

| Expectation | Requirement |
|---|---|
| Acknowledge a page | Within 5 minutes |
| Be at a laptop and online | Within 15 minutes (matches SEV1 response time) |
| Connectivity | Laptop, charger, VPN-ready connection and phone with PagerDuty app at all times |
| Alcohol / impairment | Not permitted while primary on call |
| Travel | Domestic travel only with a swap or a confirmed backup for flight time |
| Escalate if stuck | After 20 minutes without progress on SEV1/SEV2 |

If the primary does not acknowledge within 5 minutes, PagerDuty escalates to the secondary; after another 5 minutes to the Engineering Manager; after another 10 minutes to Pradeep Joshi.

## 5. Handover

At every Monday 10:00 IST handover the outgoing primary posts in `#oncall`:

- open incidents and their status;
- alerts that fired more than 3 times (candidates for tuning);
- ongoing changes or risky deploys;
- anything the incoming engineer should watch.

The handover call is 15 minutes and is mandatory for primaries.

## 6. Compensation

On-call allowance is paid through payroll in the following month, based on PagerDuty schedules exported by People Operations on the 3rd working day.

| Item | Amount |
|---|---|
| Weekday on-call (per day, primary or secondary) | ₹1,500 |
| Weekend or public holiday on-call (per day) | ₹3,000 |
| Incident Commander rota (per week) | ₹6,000 |
| Callout worked between 22:00 and 07:00 IST | ₹1,000 per callout, max ₹5,000 per week |

Additionally, an engineer who works more than 2 hours on incidents between 22:00 and 07:00 IST may take **compensatory time off** of half a day, to be used within 30 days, approved by their manager. Compensatory off does not reduce earned or casual leave.

## 7. Wellbeing and load limits

- Target: no more than **2 out-of-hours pages per on-call week** per rotation. If a rotation averages more than 5 for four consecutive weeks, the Engineering Manager must run an alert review and present an action plan to Pradeep Joshi.
- After a night incident longer than 3 hours, the engineer starts work no earlier than 13:00 IST the next day.
- Anyone may hand back a shift for illness or emergency; the manager finds cover. No questions asked.

## 8. Training and eligibility

Before joining a rotation an engineer must:

1. Complete the on-call onboarding course (approx. 6 hours) in the learning portal.
2. Shadow one full week as a third responder.
3. Complete one reverse-shadow week (acts as primary with an experienced engineer as backup).
4. Have production access approved via the access request workflow (time-bound, reviewed quarterly by ITS).

## 9. Alert quality

Every paging alert must have a linked runbook, an owner team and a severity label. Alerts without a runbook link are rejected by the alert linter in CI. Teams review all paging alerts every quarter and delete or downgrade any alert that was not actionable in 3 consecutive firings.

## 10. Reporting

Monthly on-call metrics (pages per rotation, out-of-hours pages, MTTA, compensatory offs taken) are published on the SRE dashboard and reviewed in the CTO's monthly engineering review.

## 11. Exceptions

Exceptions to this policy require written approval from the CTO, Meera Iyer.
