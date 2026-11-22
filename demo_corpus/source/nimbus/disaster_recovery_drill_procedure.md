---
title: Disaster Recovery Drill Procedure
access: Engineering
format: pdf
doc_no: NIM/ENG/SOP-001
version: 2.1
effective: 01 April 2026
review: 31 March 2027
classification: Internal
department: Infrastructure & SRE
prepared_by: Pradeep Joshi, Head of Infrastructure & SRE
approved_by: Meera Iyer, Chief Technology Officer
stamp: APPROVED
---
# Disaster Recovery Drill Procedure

## 1. Purpose

This procedure defines how Nimbus Infotech tests its ability to recover the NimbusOps platform from the loss of its primary AWS region. Regular drills give evidence for ISO 27001:2022 (control A.5.30, ICT readiness for business continuity) and the SOC 2 Type II availability criteria, and they keep the failover runbooks honest.

## 2. Scope

- Platform: NimbusOps production, primary region AWS ap-south-1 (Mumbai), DR region AWS ap-south-2 (Hyderabad).
- Components: EKS workloads, PostgreSQL 16 (Amazon RDS), Kafka (Amazon MSK), object storage (S3 with cross-region replication), DNS (Route 53), secrets (AWS Secrets Manager).
- Out of scope: corporate IT systems (covered by the IT Business Continuity Plan) and client-hosted environments (covered by each client's DR plan).

## 3. Recovery objectives

| Objective | Target | Basis |
|---|---|---|
| RPO (data loss) | 15 minutes | Customer contracts and SOC 2 commitments |
| RTO (time to restore service) | 1 hour | Customer contracts |
| Availability SLO | 99.9% monthly | NimbusOps public SLA |

A drill **passes** only if both measured RPO and RTO are within target and all verification checks in Section 8 succeed.

## 4. Drill types and frequency

| Type | Frequency | Customer impact | Description |
|---|---|---|---|
| Tabletop | Quarterly | None | Walk through the runbook with the on-call team; check contacts and access |
| Component failover | Quarterly | None (DR replica only) | Promote a copy of the DR database and Kafka mirror in isolation |
| Full regional failover | Twice a year (April and October) | Planned maintenance window, up to 60 min | Move production traffic to ap-south-2 and back |

Full drills are scheduled on a Saturday between 23:00 and 03:00 IST, the lowest-traffic window. Customers receive notice at least **14 calendar days** in advance via the status page and email.

## 5. Roles

| Role | Responsibility | Assigned |
|---|---|---|
| Drill Director | Go/no-go decisions, abort authority | Pradeep Joshi |
| Drill Incident Commander | Runs the bridge exactly as in a real SEV1 | IC rota |
| Database lead | Executes NIM/ENG/RB-001 Section 6 | Siddharth Rao or delegate |
| Application lead | Scales workloads, validates features | Neha Gupta or delegate |
| Observer / auditor | Records timings and evidence | ITS GRC analyst |
| Communications | Status page and customer notices | Customer Success duty manager |

## 6. Preparation (T-14 days to T-1 day)

1. Raise a normal change request and obtain CAB approval at least 10 days before the drill.
2. Confirm the DR region capacity reservation: `general` node group must be able to reach 40 nodes in ap-south-2.
3. Check that the DR database replica lag has stayed below 60 seconds for the previous 7 days.
4. Verify S3 cross-region replication backlog is zero (`ReplicationLatency` metric).
5. Confirm everyone on the roster has working `nops-sre-breakglass` access in both regions.
6. Freeze releases from 18:00 IST on the Friday before the drill until the drill closes.
7. Publish the go/no-go checklist in the drill channel `#dr-drill-<yyyymm>`.

## 7. Execution steps

| Step | Action | Reference | Target elapsed time |
|---|---|---|---|
| 1 | Go/no-go call; start the clock (T0) | — | 0 min |
| 2 | Status page set to "Scheduled maintenance in progress" | — | 2 min |
| 3 | Stop writers in ap-south-1 | RB-001 §6.2 | 5 min |
| 4 | Record final replica lag (this is the measured RPO) | RB-001 §6.1 | 7 min |
| 5 | Promote RDS replica in ap-south-2 | RB-001 §6.3 | 20 min |
| 6 | Switch MSK consumers to the ap-south-2 cluster via MirrorMaker 2 offsets | RB-002 | 25 min |
| 7 | Scale DR workloads to production replica counts | RB-001 §6.4 | 30 min |
| 8 | Switch Route 53 failover records | RB-001 §6.5 | 35 min |
| 9 | Run verification suite | Section 8 | 45 min |
| 10 | Declare service restored; stop the clock (measured RTO) | — | ≤ 60 min |

**Abort criteria:** the Drill Director aborts and fails back if the database promotion has not completed by T0 + 40 minutes, if any data integrity check fails, or if a real incident occurs anywhere on the platform.

## 8. Verification suite

- Synthetic login and dashboard load succeed for 3 test tenants.
- A test alert rule fires and a notification is delivered by email, Slack and webhook within 2 minutes.
- Row counts on `tenants`, `monitors` and `alert_rules` match the pre-drill snapshot.
- Agents from 5 sample customers (with prior consent) reconnect within 10 minutes.
- API p99 latency below 1.5 seconds for 15 minutes.

## 9. Fail-back

Fail-back to ap-south-1 is performed in the same window if the drill passed and time allows, otherwise within 10 business days under a separate change. Fail-back uses the same steps in reverse, with a fresh replica built from ap-south-2.

## 10. Results history

| Drill date | Type | Measured RPO | Measured RTO | Result | Main finding |
|---|---|---|---|---|---|
| 19 October 2025 | Full | 9 min | 71 min | Fail (RTO) | DNS script needed manual IAM fix |
| 17 January 2026 | Component | 4 min | n/a | Pass | — |
| 18 April 2026 | Full | 6 min | 47 min | Pass | MSK offset translation took 11 min |
| 18 July 2026 | Component | 3 min | n/a | Pass | — |

The next full regional drill is scheduled for 24 October 2026.

## 11. Reporting

Within 5 business days the Drill Director publishes a drill report covering timings, deviations, evidence (screenshots, command logs) and action items. Failed drills require a re-test within 60 days. Reports are retained for 3 years and shared with auditors on request; a summary goes to the CTO and the CISO.
