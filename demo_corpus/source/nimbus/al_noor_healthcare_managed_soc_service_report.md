---
title: Al Noor Healthcare – Managed SOC Service Report
access: Engineering
format: pdf
doc_no: NIM/DEL/RPT-004
version: 1.0
effective: 15 July 2026
review: 15 October 2026
classification: Confidential
department: Managed Services – Security Operations
prepared_by: Farah Siddiqui, SOC Service Manager
approved_by: Kavya Reddy, VP Delivery
stamp: APPROVED
---
# Al Noor Healthcare – Managed SOC Service Report

Reporting period: Q1 FY27 (1 April 2026 – 30 June 2026). Service delivered from the Nimbus Security Operations Centre, Hyderabad (HITEC City), 24x7x365.

## 1. Executive summary

The Nimbus SOC monitored Al Noor Healthcare's environment across **6 hospitals and 22 clinics** in the UAE throughout the quarter. All contractual SLAs were met. There were **no confirmed data breaches**. The most significant event was a targeted phishing campaign in May 2026 impersonating a medical equipment supplier, contained within 41 minutes with two mailboxes compromised and no patient data accessed.

| Headline | Q1 FY27 | Q4 FY26 |
|---|---|---|
| Security events ingested (daily average) | 1.84 million | 1.62 million |
| Alerts triaged by analysts | 1,126 | 1,204 |
| Incidents raised to client | 38 | 44 |
| P1 incidents | 1 | 0 |
| False positive rate (alerts) | 71% | 78% |
| Mean time to detect (MTTD) | 9 minutes | 12 minutes |
| Mean time to respond (MTTR, P1–P2) | 2.1 hours | 2.6 hours |

## 2. Scope of service

| Service element | Coverage |
|---|---|
| SIEM monitoring | Microsoft Sentinel, 1,940 log sources |
| Endpoint detection and response | 7,850 endpoints (CrowdStrike Falcon) |
| Email security monitoring | 9,200 mailboxes |
| Medical IoT visibility | 2,300 connected medical devices (passive monitoring) |
| Vulnerability management | Monthly external scans; quarterly internal scans |
| Threat intelligence | Healthcare sector feeds, UAE regional advisories |
| Incident response | Remote containment; on-site support in Dubai within 24 hours (up to 10 days per year) |

## 3. SLA performance

| SLA | Target | Achieved | Status |
|---|---|---|---|
| P1 alert acknowledged and client notified | 15 minutes | 100% (1/1), 11 min | Met |
| P2 notification | 30 minutes | 100% (9/9), avg 18 min | Met |
| P3 notification | 4 hours | 95.8% (23/24 within target; contract minimum 95%) | Met |
| SIEM platform availability | 99.5% | 99.94% | Met |
| Monthly report delivery | 5th working day | All on time | Met |
| Critical vulnerability notification | 24 hours of detection | 100% | Met |

No service credits are due for the quarter.

## 4. Incidents by priority and category

| Category | P1 | P2 | P3 | P4 | Total |
|---|---|---|---|---|---|
| Phishing / business email compromise | 1 | 3 | 6 | 2 | 12 |
| Malware on endpoint | 0 | 2 | 5 | 1 | 8 |
| Suspicious authentication (impossible travel, brute force) | 0 | 2 | 7 | 0 | 9 |
| Policy violation (USB, unapproved cloud storage) | 0 | 0 | 4 | 1 | 5 |
| Vulnerable internet-facing service | 0 | 2 | 1 | 0 | 3 |
| Medical IoT anomaly | 0 | 0 | 1 | 0 | 1 |
| **Total** | **1** | **9** | **24** | **4** | **38** |

The one P3 notified late (AN-SOC-0587, 4 h 26 min) was delayed by a SIEM connector outage at the client's Sharjah clinic.

## 5. Notable incident – AN-SOC-0612 (P1)

- **Date:** 19 May 2026, detected 10:42 GST (12:12 IST).
- **What happened:** Phishing emails impersonating a supplier of imaging equipment were sent to 64 staff in procurement and radiology. Two users entered credentials on a fake login page; one account was used to create a mail-forwarding rule.
- **Response:** Accounts disabled and sessions revoked at 11:09 GST; malicious forwarding rule removed; 62 copies of the email purged from mailboxes; sender domain blocked. Containment completed at **11:23 GST (41 minutes after detection)**.
- **Impact:** No access to clinical systems or patient records, confirmed by review of Sentinel and EHR access logs. Al Noor's Data Protection Officer was informed and determined no regulatory notification was required.
- **Follow-up:** Conditional access policy now requires phishing-resistant MFA for procurement staff; targeted awareness session delivered on 2 June 2026.

## 6. Vulnerability management

| Severity | Open at start | New | Closed | Open at end | Past client SLA |
|---|---|---|---|---|---|
| Critical | 4 | 9 | 11 | 2 | 0 |
| High | 37 | 58 | 61 | 34 | 6 |
| Medium | 212 | 140 | 166 | 186 | 21 |

The 6 High findings past SLA relate to legacy Windows Server 2012 R2 systems supporting the laboratory information system; Al Noor has accepted the risk until the planned replacement in Q3 FY27, with network isolation as a compensating control.

## 7. Improvements delivered this quarter

1. Tuned 46 noisy Sentinel analytics rules, reducing false positives from 78% to 71%.
2. Added detection content for 12 healthcare-specific threats, including HL7 interface abuse.
3. Onboarded the new Al Barsha clinic (log sources live on 9 April 2026).
4. Automated phishing triage playbook (Logic Apps) reducing analyst effort per reported email from 14 to 4 minutes.

## 8. Recommendations

| # | Recommendation | Priority | Client owner |
|---|---|---|---|
| 1 | Extend phishing-resistant MFA to all staff with access to patient data | High | Al Noor CISO |
| 2 | Replace or isolate the 31 medical devices running unsupported operating systems | High | Biomedical Engineering |
| 3 | Run a joint ransomware tabletop exercise in Q2 FY27 | Medium | Al Noor IT Director |
| 4 | Enable Sentinel UEBA for privileged accounts (additional ingestion cost ~AED 4,800 per month) | Medium | Al Noor CISO |

## 9. Compliance notes

Monitoring and data handling continue to follow the service agreement, the UAE Federal Decree-Law No. 45 of 2021 on personal data protection, and the Dubai Health Authority's information security requirements as applicable to Al Noor. All log data remains in Al Noor's Azure tenant in the UAE North region; Nimbus analysts access it through Azure Lighthouse with just-in-time privileged access.

## 10. Service contacts

| Role | Name | Contact route |
|---|---|---|
| SOC Service Manager | Farah Siddiqui | Monthly service review, escalation level 2 |
| SOC Shift Lead (24x7) | Rotating | SOC hotline, escalation level 1 |
| Delivery executive | Kavya Reddy, VP Delivery | Escalation level 3 |
| Nimbus CISO (advisory) | Sameer Khan | Quarterly security review |
