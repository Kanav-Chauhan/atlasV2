---
title: Harbor Logistics – Incident Post-Mortem INC-2291
access: Engineering
format: pdf
doc_no: NIM/DEL/RPT-006
version: 1.1
effective: 18 June 2026
review: 18 September 2026
classification: Confidential
department: Delivery – North America
prepared_by: Karthik Subramanian, Delivery Manager – Harbor Logistics
approved_by: Kavya Reddy, VP Delivery
stamp: APPROVED
---
# Harbor Logistics – Incident Post-Mortem INC-2291

## 1. Summary

| Item | Detail |
|---|---|
| Incident | INC-2291 – HarborTrack WMS unavailable |
| Client | Harbor Logistics Inc. |
| Date | Thursday 11 June 2026 |
| Start (impact) | 02:14 ET (11:44 IST) |
| Mitigated | 05:01 ET (14:31 IST) |
| Duration of impact | 2 hours 47 minutes |
| Severity | SEV1 (customer-wide outage of a business-critical application) |
| Incident Commander | Daniel Brooks, Engagement Lead |
| Root cause category | Change management – infrastructure-as-code |
| Service credit | USD 17,500 (5% of monthly managed services fee) |

This is a blameless review. Its purpose is to understand how our systems and processes allowed the failure and to prevent recurrence.

## 2. Impact

- HarborTrack, Harbor's warehouse management system, could not connect to its PostgreSQL database for 2 hours 47 minutes.
- **38 of 41 distribution centres** were unable to release outbound shipments or print shipping labels. The three remaining sites run a legacy local system.
- Approximately **11,400 orders** were delayed; Harbor estimates 2,300 missed same-day carrier pickups.
- No data was lost. All queued scanner transactions were replayed after recovery.

## 3. Background

HarborTrack's application tier was moved to AWS in wave 9. Its database (Amazon RDS for PostgreSQL, `ht-prod-db`) had been migrated in wave 8 and shared a security group, `sg-ht-db`, with two reporting services. Wave 9 Terraform code refactored security groups into a new module so each application had its own group.

## 4. Timeline (Eastern Time)

| Time | Event |
|---|---|
| 01:30 | Wave 9 cutover window opens (approved change CHG-HL-1182). |
| 01:52 | Terraform apply for module `ht-network` starts. Plan showed "1 to add, 1 to change, 1 to destroy" for security groups. |
| 02:09 | Old `sg-ht-db` replaced; new group created **without** the inbound rule from the HarborTrack app subnets (rule referenced a variable left empty in the wave 9 tfvars). |
| 02:14 | HarborTrack app servers start failing database connections. Scanners at distribution centres show "Server unavailable". |
| 02:31 | First call from Harbor's Atlanta DC to Harbor service desk. Nimbus NOC not yet alerted: the database connectivity check for HarborTrack was scheduled to be onboarded to NimbusOps after cutover. |
| 02:46 | Harbor service desk calls Nimbus NOC (Bengaluru). P1 opened; SEV1 declared at 02:51. |
| 02:58 | Bridge opened; Daniel Brooks takes IC role. Migration team assumes app-tier misconfiguration and starts checking the new load balancer. |
| 03:40 | Engineer identifies `connection timed out` (not `refused`) in app logs, pointing to network. |
| 04:22 | Security group diff identified as cause. Decision: add the missing rule rather than roll back the whole wave (rollback estimated at 90 min). |
| 04:36 | Emergency change approved by Harbor CAB on-call (Tom Reyes). Rule added via Terraform. |
| 04:41 | Database connections succeed; app servers restarted to clear connection pools. |
| 05:01 | All distribution centres confirm normal operations. Impact ends. |
| 06:30 | Incident resolved after 90 minutes of stable operation. |

## 5. Root cause

The wave 9 Terraform change replaced the shared database security group. The new group's inbound rule was built from the variable `app_subnet_cidrs`, which was empty in the wave 9 variables file because the value had been moved to a different module. Terraform accepted an empty list, created the group with no inbound rule and the plan output did not make this obvious.

## 6. Contributing factors

1. **Plan review missed the replacement.** The plan was reviewed by one engineer at 01:50 under time pressure; the "destroy" of a security group was not flagged as high risk.
2. **No validation on empty CIDR lists.** The module allowed an empty list for a required rule.
3. **Monitoring gap during cutover.** HarborTrack's database connectivity check was planned for onboarding after cutover, so Nimbus learned of the outage from the client 32 minutes after impact began.
4. **Diagnosis took 1 h 31 min from declaration.** The team initially focused on the new load balancer; there was no cutover-specific troubleshooting checklist.
5. **Shared security group** across three services increased blast radius.

## 7. What went well

- Harbor's CAB approved the emergency change within 14 minutes.
- No data loss; scanner queues replayed successfully.
- Client updates were sent every 30 minutes from 03:05 onwards, as required by the escalation matrix.

## 8. Corrective and preventive actions

| # | Action | Owner | Due | Status |
|---|---|---|---|---|
| 1 | Add `validation` blocks to network modules to reject empty CIDR lists for required rules | Migration platform lead (Pune) | 19 June 2026 | Closed |
| 2 | CI policy (OPA/Conftest) to fail any plan that destroys or replaces a security group attached to a production database unless an override label is approved by the cloud architect | Daniel Brooks | 30 June 2026 | Closed |
| 3 | Onboard database and dependency connectivity checks to NimbusOps **before** cutover, not after | NOC lead (Bengaluru) | 26 June 2026 | Closed |
| 4 | Two-person plan review for all production network changes during cutovers | Karthik Subramanian | 19 June 2026 | Closed |
| 5 | Cutover troubleshooting checklist (network → DNS → database → application order) | Daniel Brooks | 30 June 2026 | Closed |
| 6 | Split remaining shared security groups (14 identified) into per-service groups | Migration factory | 31 July 2026 | Open |
| 7 | Pre-cutover connectivity verification gate added to wave runbook (CR-HL-047) | Karthik Subramanian | 31 July 2026 | Open |

## 9. Commercial outcome

Under the MSA service level schedule, a P1 outage of a business-critical application exceeding 2 hours earns a service credit of 5% of the monthly managed cloud operations fee (USD 112,500), i.e. **USD 17,500**, applied to the June 2026 invoice. Harbor accepted the credit and this report at the steering committee on 15 July 2026.

## 10. Distribution

Harbor: Margaret Ellison (CIO), Tom Reyes (VP Infrastructure), Raj Patel (Director, Warehouse Systems). Nimbus: Kavya Reddy, Arjun Nair, Pradeep Joshi (for the cross-account learning on infrastructure-as-code validation).
