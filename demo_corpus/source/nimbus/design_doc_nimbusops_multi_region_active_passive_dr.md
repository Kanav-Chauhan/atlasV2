---
title: Design Doc – NimbusOps Multi-Region Active-Passive DR
access: Engineering
format: md
doc_no: NIM/ENG/PRO-002
version: 1.1
effective: 04 June 2026
review: 31 December 2026
classification: Internal
department: Engineering – NimbusOps
prepared_by: Siddharth Rao, Principal Architect
approved_by: Meera Iyer, Chief Technology Officer
stamp: none
---
# Design Doc – NimbusOps Multi-Region Active-Passive DR

**Status:** Accepted by the Architecture Review Board on 4 June 2026 (ADR-0042). **Authors:** Siddharth Rao, Pradeep Joshi. **Reviewers:** Neha Gupta, Sameer Khan.

## 1. Context

NimbusOps commits to 99.9% monthly availability, an RPO of 15 minutes and an RTO of 1 hour. The primary region is AWS **ap-south-1 (Mumbai)** and the DR region is AWS **ap-south-2 (Hyderabad)**. All customer data must stay in India.

Today the DR region is a warm standby at about 30% capacity. Failover is a manual sequence of runbook steps (NIM/ENG/RB-001 Section 6), coordinated on a SEV1 bridge. Recent full drills:

| Drill | Measured RPO | Measured RTO | Result |
|---|---|---|---|
| 19 October 2025 | 9 min | 71 min | Fail (RTO) – DNS script needed a manual IAM fix |
| 18 April 2026 | 6 min | 47 min | Pass – MSK offset translation took 11 min |

We pass, but with little margin. The April drill needed 14 manual commands from 4 people, and the RTO depends on Karpenter being able to scale the DR cluster from 30% to full capacity during a regional event, when other AWS customers will be doing the same.

## 2. Goals

1. Keep the contractual RPO of 15 minutes and RTO of 1 hour with a wide margin. **Design targets: RPO of 5 minutes and RTO of 30 minutes.**
2. Reduce manual steps from 14 to 3 or fewer (decide, approve, verify).
3. Make the drill and a real failover use exactly the same automation.

### Non-goals

- Active-active (serving traffic from both regions at once). Rejected in Section 6.
- A region outside India. The planned EU region is a separate design.

## 3. Proposed design

### 3.1 Topology

| Component | Primary (ap-south-1) | DR (ap-south-2) today | DR after this change |
|---|---|---|---|
| EKS | `nops-prod-aps1` | `nops-dr-aps2` at ~30% | **50% baseline** with reserved capacity for 100% |
| PostgreSQL 16 (RDS) | Multi-AZ `nops-prod-pg01` | Cross-region read replica | Same, plus replica lag alarm at **60 s** |
| Kafka (MSK) | 6 brokers | 3 brokers, MirrorMaker 2 | 6 brokers; MirrorMaker 2 with **offset sync every 60 s** |
| VictoriaMetrics | Full cluster | Downsampled replica | Full-resolution replica for the last 15 days |
| S3 | Primary buckets | Cross-region replication | Same, with Replication Time Control (15-min SLA) |
| DNS | Route 53 | Failover records | Route 53 Application Recovery Controller routing controls |

### 3.2 Failover orchestration

A single failover workflow (AWS Step Functions in ap-south-2, so it works when ap-south-1 is down) runs the steps that are manual today:

1. Fence the primary: scale ap-south-1 writers to zero if the EKS API is reachable; otherwise continue.
2. Record replica lag (measured RPO) and stop if lag is above 15 minutes, asking the Incident Commander to decide.
3. Promote `nops-dr-pg01` and enable Multi-AZ.
4. Switch consumers to the DR MSK cluster using the pre-synced offsets (removes the 11-minute step seen in April).
5. Scale DR workloads from 50% to production replica counts.
6. Flip the Route 53 routing control.
7. Run the verification suite from the Disaster Recovery Drill Procedure.

The workflow needs two human inputs: the **Incident Commander's approval** to start, and a second approval from the Head of Infrastructure & SRE or the CTO. Both are recorded in the incident channel.

### 3.3 Expected timings

| Step | Today (April 2026 drill) | Target |
|---|---|---|
| Decision and approval | 6 min | 5 min |
| Database promotion | 13 min | 10 min |
| Kafka consumer switch | 11 min | 2 min |
| Scale workloads | 9 min | 5 min |
| DNS and verification | 8 min | 8 min |
| **Total (RTO)** | **47 min** | **30 min** |

## 4. Cost

| Item | Monthly cost (₹ lakh) |
|---|---|
| DR EKS baseline from 30% to 50% | 4.8 |
| MSK DR cluster from 3 to 6 brokers | 2.6 |
| VictoriaMetrics full-resolution replica | 1.5 |
| Route 53 ARC and Step Functions | 0.7 |
| **Total additional** | **9.6** |

The additional ₹9.6 lakh per month is above the ₹5 lakh threshold in the Cloud Cost Management Guideline and was approved by Pradeep Joshi (Head of Infrastructure & SRE) on 2 June 2026. It is funded from the FY27 NimbusOps cloud budget.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Split brain: both regions accept writes | Fencing step; RDS replica cannot accept writes until promoted; ingest-api checks a region flag before writing |
| Automation fails during a real event | Runbook RB-001 stays valid as the manual fallback; quarterly component drills exercise the workflow |
| Failover triggered for a short blip | Human approval always required; no automatic failover |
| Hyderabad capacity shortage during a regional event | 50% baseline plus on-demand capacity reservation for the remaining 50% |

## 6. Alternatives considered

1. **Active-active across both regions.** Rejected: PostgreSQL 16 on RDS has a single writer, and tenant sharding is only planned for Q3 FY27. Cost estimated at ₹38 lakh per month extra.
2. **Pilot light (database only in DR).** Rejected: RTO would rise above 1 hour.
3. **Keep today's design and only automate DNS.** Rejected: does not fix the Kafka offset delay or capacity risk.

## 7. Rollout

| Milestone | Date |
|---|---|
| ARB approval | 4 June 2026 |
| DR baseline at 50% and MSK expanded | 31 July 2026 |
| Step Functions workflow in staging | 31 August 2026 |
| First full drill using the workflow | October 2026 full drill |

## 8. Decision log

| Date | Decision | By |
|---|---|---|
| 21 May 2026 | Stay active-passive; active-active deferred until tenant sharding | ARB |
| 28 May 2026 | DR baseline 50%, not 100% (saves ₹4.8 lakh per month) | Meera Iyer |
| 2 June 2026 | Additional cloud spend of ₹9.6 lakh per month approved | Pradeep Joshi |
| 4 June 2026 | Design accepted as ADR-0042 | ARB (chair Siddharth Rao) |
