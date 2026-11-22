---
title: Client Escalation Matrix
access: Engineering
format: docx
doc_no: NIM/DEL/SOP-001
version: 4.1
effective: 01 April 2026
review: 31 March 2027
classification: Internal
department: Delivery
prepared_by: Kavya Reddy, VP Delivery
approved_by: Vikram Kulkarni, Founder & CEO
stamp: APPROVED
---
# Client Escalation Matrix

## 1. Purpose

Clients must always know whom to call, and Nimbus staff must know when to pull in senior help. This procedure defines escalation levels, time limits and communication rules for client-facing issues across all service lines. Client-specific contracts may set shorter timelines; the contract always prevails.

## 2. What counts as an escalation

An escalation is any of the following:

- a production incident of priority P1 or P2 on a system Nimbus builds or operates;
- a formal complaint from a client stakeholder at Director level or above;
- a risk to a contractual milestone, SLA or payment;
- a breach of security or confidentiality involving client data;
- a commercial dispute (billing, change requests, penalties).

## 3. Priority definitions (client incidents)

Priorities for client systems map to Nimbus internal severities.

| Client priority | Nimbus severity | Definition | Response | Client update frequency |
|---|---|---|---|---|
| P1 – Critical | SEV1 | Business-critical system down or data breach | 15 minutes | Every 30 minutes |
| P2 – High | SEV2 | Major function degraded, workaround difficult | 30 minutes | Every 2 hours |
| P3 – Medium | SEV3 | Single user group or non-critical function affected | 4 hours | Daily |
| P4 – Low | SEV4 | Query, cosmetic issue | Next business day | On resolution |

## 4. Escalation levels

| Level | Nimbus role | Escalate to this level when | Time to escalate (P1) | Time to escalate (P2) |
|---|---|---|---|---|
| L1 | Project Manager / Service Delivery Lead / SOC Shift Lead | Issue raised | Immediately | Immediately |
| L2 | Delivery Manager / SOC Service Manager | Not mitigated, or client asks | 30 minutes | 4 hours |
| L3 | VP Delivery (Kavya Reddy) | Not mitigated, or client Director+ complaint | 2 hours | 1 business day |
| L4 | CTO (Meera Iyer) for technical; CEO (Vikram Kulkarni) for relationship | Not mitigated, contract at risk, or client C-level involved | 4 hours | 3 business days |

Security incidents involving client data are escalated to the CISO, **Sameer Khan**, at L2 regardless of priority, and legal counsel is informed within 24 hours.

## 5. Account-specific escalation contacts

| Account | L1 | L2 | L3 | Account executive |
|---|---|---|---|---|
| Harbor Logistics (US) | Wave lead / NOC shift lead (Bengaluru) | Karthik Subramanian | Kavya Reddy | Arjun Nair |
| Zenith Retail (India) | Ananya Pillai | Delivery Manager, Enterprise Apps | Kavya Reddy | Head of Sales, India |
| Al Noor Healthcare (UAE) | SOC Shift Lead (Hyderabad, 24x7) | Farah Siddiqui | Kavya Reddy | Head of Sales, Middle East (Dubai office) |
| Crestline Insurance (US) | Project manager, Bengaluru | Mohit Agarwal | Kavya Reddy | Arjun Nair |
| NimbusOps customers | Customer Success Manager / support | Neha Gupta (Engineering Manager) | Meera Iyer (CTO) | Account executive |

Contact numbers are maintained in the delivery portal under "Escalation contacts" and are reviewed on the first business day of every quarter.

## 6. Communication rules

1. The first client communication for a P1 goes out within **30 minutes** of Nimbus becoming aware, even if the cause is unknown.
2. Updates follow the frequency in Section 3, from the named L2 owner or a delegate, by email plus the client's preferred channel (Teams, Slack Connect, phone).
3. Every update contains: current status, impact, actions in progress, next update time.
4. Do not speculate on root cause or blame third parties in writing during an incident.
5. A client-facing root cause analysis (RCA) is sent within **5 business days** of resolution for every P1 and within 10 business days for P2s if the client requests one.
6. For time zones: US clients are served by the onshore lead during US business hours and by the offshore L2 out of hours; the Middle East is covered from Hyderabad and the Dubai sales office.

## 7. Internal notifications

| Event | Notify | Channel | Within |
|---|---|---|---|
| Any P1 | VP Delivery, account executive | Phone + `#delivery-escalations` | 30 minutes |
| P1 lasting > 2 hours | CTO, CEO | Phone | Immediately at 2 hours |
| Service credit or penalty likely | CFO (Rohan Bhatia), VP Delivery | Email | 1 business day |
| Client threatens termination | CEO, VP Delivery, account executive | Phone | Same day |
| Client data breach suspected | CISO, VP Delivery | Phone + `#sec-incident` | 15 minutes |

## 8. Commercial escalations

Billing disputes are raised by the Delivery Manager with Finance within 2 business days. Credit notes or waivers require approval per the Discount Approval Policy (Sales Proposals collection) and the CFO for any amount above USD 10,000 or ₹8 lakh.

## 9. Closure and review

An escalation is closed when the client confirms in writing (email is sufficient) that the issue is resolved. All L3 and L4 escalations are reviewed in the monthly Delivery Excellence meeting chaired by Kavya Reddy, where lessons are captured and shared across accounts. Escalation volume and time to closure are reported to the leadership team each quarter.

## 10. Example

In INC-2291 (Harbor Logistics, 11 June 2026) the incident was declared P1 at 02:51 ET; the L2 owner was engaged at 02:58 ET, L3 (VP Delivery) was notified at 03:20 ET, and client updates were sent every 30 minutes from 03:05 ET until resolution, in line with this matrix.
