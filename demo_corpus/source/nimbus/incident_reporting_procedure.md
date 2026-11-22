---
title: Incident Reporting Procedure
access: Everyone
format: pdf
doc_no: NIM/ITS/SOP-001
version: 4.0
effective: 01 April 2026
review: 31 March 2027
classification: Internal
department: Information Security
prepared_by: Sameer Khan, Chief Information Security Officer
approved_by: Meera Iyer, Chief Technology Officer
stamp: APPROVED
---
# Incident Reporting Procedure

## 1. Purpose

This procedure tells every Nimbus employee how to report a security or service incident, how incidents are classified by severity, and who is notified. Fast reporting limits damage: when in doubt, report.

## 2. Scope

Applies to all employees and contractors, and to incidents affecting Nimbus corporate IT, client environments managed by Nimbus, and the NimbusOps SaaS platform. The technical response steps for engineers are in the *SEV1 Incident Response Runbook* (Engineering Runbooks); this document covers reporting and classification for everyone.

## 3. What to report

Report any of the following, even if you are not sure it is real:

1. A phishing email you clicked, or a suspicious email you received.
2. A lost or stolen laptop, phone or security key.
3. Data sent to the wrong person or uploaded to the wrong place.
4. Malware alerts, unexpected pop-ups, or a device behaving strangely.
5. Unauthorised access, a shared password, or an account you do not recognise.
6. An outage or serious degradation of NimbusOps or a client system we run.
7. Physical security issues: tailgating, an unknown person in a restricted area.

## 4. How to report

| Situation | Channel | Timeline |
|---|---|---|
| Suspicious email (not clicked) | Forward as attachment to **phish@nimbus.example** or use the *Report Phish* button | Same day |
| Clicked a link / entered credentials | Call the SOC on extension 7000 (24x7), then email security@nimbus.example | Immediately, within 30 minutes |
| Lost or stolen device | ServiceDesk ext. 4357 or security@nimbus.example | Within 1 hour |
| Data sent to wrong recipient | security@nimbus.example and your manager | Within 1 hour |
| Service outage (NimbusOps or client) | Page the on-call via the incident bot: `/incident declare` in Slack | Immediately |

Do **not** try to investigate on your own, delete evidence, or contact the attacker. Do not discuss the incident on public channels.

## 5. Severity classification

The SOC or on-call incident commander assigns the severity. Severity can be raised or lowered as more is learnt.

| Severity | Definition | Response time | Who is engaged |
|---|---|---|---|
| **SEV1** | Customer-wide outage, or confirmed breach of Confidential/Restricted data | 15 minutes | Incident commander; CISO and CTO paged; Head of Infrastructure & SRE |
| **SEV2** | Significant degradation affecting many customers, or a contained security compromise | 30 minutes | Incident commander, service owner, SOC lead |
| **SEV3** | Issue affecting a single customer or user, or a policy violation without data loss | 4 hours | Service team or SOC analyst |
| **SEV4** | Minor issue, no customer impact | Next business day | Owning team via ticket |

Response time means the time within which a responder acknowledges and starts working, 24x7 for SEV1 and SEV2, and during business hours for SEV3 and SEV4.

## 6. Notification and escalation

### 6.1 Internal

| Severity | Notify | Update frequency |
|---|---|---|
| SEV1 | CISO, CTO, CEO (within 1 hour), VP Delivery for client-facing incidents | Every 30 minutes |
| SEV2 | CISO or CTO (depending on type), service owner's VP | Every 1 hour |
| SEV3 | Team manager | Daily |
| SEV4 | — | On ticket |

### 6.2 Clients

Client notification follows the contract. Where the contract is silent, delivery managers notify affected clients within 4 hours for SEV1 and within 24 hours for SEV2. All external communication is approved by the incident commander and the account's delivery head.

### 6.3 Regulators

- **CERT-In:** Cyber incidents of the types listed in the CERT-In directions are reported within **6 hours** of being noticed. The CISO's office files the report.
- **Data Protection Board of India:** Personal data breaches are reported as described in the *Data Protection Policy – DPDP Act 2023*.

## 7. After reporting

1. The SOC opens an incident record and gives you a reference number (format `SEC-YYYY-NNNN` for security, `INC-NNNN` for service incidents).
2. You may be asked to hand over your device; IT will issue a loaner.
3. Keep notes of what you saw and when.
4. You will be told when the incident is closed.

## 8. Post-incident review

- SEV1 and SEV2 incidents require a blameless post-mortem within **5 working days** of resolution, owned by the incident commander and reviewed by the CTO or CISO.
- Action items are tracked in Jira with owners and due dates; SEV1 actions are reviewed weekly until closed.
- Post-mortems involving clients are shared with the client after delivery head review.

## 9. No-blame reporting

Nimbus will not take disciplinary action against anyone for promptly reporting an honest mistake, such as clicking a phishing link. Failure to report a known incident, or deliberately hiding one, is a disciplinary matter.

## 10. Metrics

The CISO reports monthly to the Information Security Steering Committee on number of incidents by severity, mean time to acknowledge, mean time to resolve and phishing report rates.
