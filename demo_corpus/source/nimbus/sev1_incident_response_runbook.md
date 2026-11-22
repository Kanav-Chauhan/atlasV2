---
title: SEV1 Incident Response Runbook
access: Engineering
format: md
doc_no: NIM/ENG/RB-004
version: 3.0
effective: 01 April 2026
review: 31 March 2027
classification: Internal
department: Infrastructure & SRE
prepared_by: Pradeep Joshi, Head of Infrastructure & SRE
approved_by: Meera Iyer, Chief Technology Officer
stamp: none
---
# SEV1 Incident Response Runbook

## 1. Purpose

This runbook tells engineers exactly what to do in the first hour of a SEV1 incident on NimbusOps or on a managed client platform. It complements the company-wide Incident Reporting Procedure; where they differ for production engineering incidents, this runbook applies.

## 2. Severity levels

| Severity | Definition | Response time | Who is paged |
|---|---|---|---|
| SEV1 | Customer-wide outage, or data breach suspected | 15 min | Primary + secondary on-call, Incident Commander rota, CISO and CTO |
| SEV2 | Service degraded for many customers (slow, partial features down) | 30 min | Primary on-call, Engineering Manager |
| SEV3 | Single customer impacted | 4 h | Primary on-call (business hours escalation) |
| SEV4 | Minor issue, no customer impact | Next business day | Ticket only |

When in doubt, declare the higher severity. Downgrading later is free; a late SEV1 is not.

## 3. Declare

Anyone can declare. In Slack:

```
/incident declare sev1 "NimbusOps UI and API returning 503 for all tenants"
```

This creates `#inc-<date>-<number>`, opens a Zoom bridge, starts the timeline and pages per the table above. The CISO (Sameer Khan) and CTO (Meera Iyer) are paged automatically for every SEV1.

## 4. Roles

| Role | Who | Responsibilities |
|---|---|---|
| Incident Commander (IC) | IC rota (senior SREs and EMs) | Owns decisions, assigns work, approves risky actions (failover, rollback, data fixes) |
| Operations Lead | Primary on-call | Hands-on investigation and mitigation |
| Communications Lead | Secondary on-call, or Customer Success duty manager | Status page, customer emails, internal updates |
| Scribe | Anyone free, assigned by IC | Keeps the timeline in the incident doc |
| Subject-matter experts | Pulled in by IC | Database, Kafka, network, security |

The IC does not debug. If you are the only person available, you are IC until relieved; ask for help immediately.

## 5. First 15 minutes checklist

- [ ] Acknowledge the page within 5 minutes.
- [ ] Join the bridge; IC states: "I am IC. Current severity SEV1. Next update at HH:MM."
- [ ] Confirm impact: which tenants, which features, since when (Grafana **NimbusOps / SLO Overview**).
- [ ] Check what changed: deploys in `#deploys`, feature flags (`nopsctl feature-flag audit --since 3h`), infra changes in the CAB calendar, AWS Health Dashboard for ap-south-1.
- [ ] Freeze all non-incident deploys: `/deploy freeze on reason="SEV1 in progress"`.
- [ ] Communications Lead posts the first status page update ("Investigating").

## 6. Mitigate first, root-cause later

Prefer the fastest safe action that restores service:

| Symptom | First mitigation | Runbook |
|---|---|---|
| Errors began after a release | Roll back | NIM/ENG/SOP-002 |
| Database unavailable | Failover | NIM/ENG/RB-001 |
| Alerts delayed | Scale consumers, catch-up mode | NIM/ENG/RB-002 |
| Pods evicted / nodes unhealthy | Drain and replace nodes | NIM/ENG/RB-003 |
| TLS errors in browsers | Emergency certificate renewal | NIM/ENG/RB-005 |
| Region-wide AWS outage | DR failover to ap-south-2 | NIM/ENG/SOP-001 |

## 7. Communication cadence

| Audience | Channel | Frequency |
|---|---|---|
| Customers | Status page (status.nimbusops.example) | First update within 30 minutes of declaration, then every 30 minutes |
| Enterprise customers with named CSM | Email from CSM | Within 1 hour |
| Internal leadership | `#inc-leadership` | Every 30 minutes |
| Managed-services clients (contractual) | Per client escalation matrix (NIM/DEL/SOP-001) | Per contract, typically 30 minutes |

Status page wording must be approved by the IC. Never name a suspected root cause or a third party on the public page during the incident.

## 8. Security incidents

If there is any sign of unauthorised access, data exfiltration or ransomware:

1. The IC hands security decisions to the CISO or the SOC duty lead.
2. Preserve evidence: no instance termination, no log deletion; snapshot volumes first.
3. Personal data breaches may require notification to CERT-In within 6 hours and to the Data Protection Board under the DPDP Act 2023; the CISO decides.

## 9. Resolve

An incident is **mitigated** when customer impact has stopped, and **resolved** when it has stayed stopped for 60 minutes with the root cause understood well enough to prevent immediate recurrence.

```
/incident resolve summary="Rolled back nops-api 2026.18.2; error rate normal since 14:52 IST"
/deploy freeze off
```

## 10. Post-incident review (PIR)

- Draft PIR within **3 business days**, review meeting within **5 business days**, owned by the IC.
- Blameless format: timeline, impact (minutes, tenants, SLO budget consumed), contributing factors, what went well, action items with owners and due dates.
- SEV1 action items marked P1 must be closed within 30 days. Pradeep Joshi reviews open items weekly.
- For client-facing incidents, the Delivery Manager sends the client-facing RCA within 5 business days (see the Harbor Logistics INC-2291 post-mortem for an example).

## 11. Metrics we track

| Metric | FY27 target |
|---|---|
| Mean time to acknowledge (SEV1) | < 5 min |
| Mean time to mitigate (SEV1) | < 45 min |
| SEV1 count per quarter (NimbusOps) | ≤ 2 |
| PIRs completed on time | 100% |
