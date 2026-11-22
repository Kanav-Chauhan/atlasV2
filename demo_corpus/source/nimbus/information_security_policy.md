---
title: Information Security Policy
access: Everyone
format: pdf
doc_no: NIM/ITS/POL-001
version: 6.0
effective: 01 April 2026
review: 31 March 2027
classification: Internal
department: Information Security
prepared_by: Sameer Khan, Chief Information Security Officer
approved_by: Vikram Kulkarni, Founder & CEO
stamp: APPROVED
---
# Information Security Policy

## 1. Purpose

This is the top-level information security policy of Nimbus Infotech Pvt. Ltd. It states management's commitment to protecting the confidentiality, integrity and availability of Nimbus and client information, and it sets the framework under which all other security policies, standards and procedures are issued. It forms part of the Information Security Management System (ISMS) certified to **ISO 27001:2022** and supports the **SOC 2 Type II** report for NimbusOps.

## 2. Scope

The policy applies to:

- All employees, contractors, interns and third parties with access to Nimbus systems or data.
- All Nimbus locations: Pune, Bengaluru, Hyderabad, Dubai, and client sites where Nimbus staff work.
- All information assets: corporate IT, client environments we manage, and the NimbusOps SaaS platform (AWS ap-south-1 Mumbai, DR in ap-south-2 Hyderabad).

## 3. Security objectives

| Objective | Measure | FY2026-27 target |
|---|---|---|
| No loss of client data | Reportable data breaches | 0 |
| Security-aware workforce | Annual awareness training completion | 100% by 30 September |
| Phishing resilience | Click rate in quarterly phishing simulations | Below 4% |
| Patch discipline | Critical vulnerabilities fixed within SLA | 95% or more |
| Certification | ISO 27001 surveillance audit | No major non-conformity |
| Access hygiene | Quarterly access reviews completed on time | 100% |

## 4. Roles and responsibilities

| Role | Responsibility |
|---|---|
| CEO | Owns the ISMS; approves this policy |
| CISO (Sameer Khan) | Runs the security programme, issues standards, reports to the Board quarterly |
| Information Security Steering Committee | CTO, CISO, CFO, Chief People Officer, VP Delivery; meets monthly; approves risk treatment |
| Head of Infrastructure & SRE (Pradeep Joshi) | Implements infrastructure controls, patching and backups |
| Managers | Approve and review access for their teams; enforce policy |
| Employees | Follow this policy and report incidents immediately |
| Security Operations Centre (SOC) | 24x7 monitoring, triage and incident coordination |

## 5. Policy framework

This policy is supported by the following documents, all in the *IT & Security Policies* collection:

1. Acceptable Use Policy
2. Password and MFA Standard
3. Laptop and Device Security Standard
4. Data Classification and Handling Policy
5. Incident Reporting Procedure
6. Remote Access and VPN Guideline
7. Data Protection Policy – DPDP Act 2023

Engineering-specific standards (Secure SDLC, logging and observability) are published in the *Architecture & Standards* collection.

## 6. Policy statements

### 6.1 Risk management

Information security risks are assessed at least once a year and whenever a major change occurs (new client programme, new region, acquisition). Risks are scored on a 5x5 likelihood-impact matrix; any risk scoring 15 or above requires a treatment plan approved by the Steering Committee within 30 days.

### 6.2 Access control

- Access is granted on least privilege and need-to-know, approved by the asset owner.
- All user accounts are named; shared accounts are not permitted except break-glass accounts held by SRE.
- Multi-factor authentication is mandatory for all users and all systems that support it.
- Managers review team access every quarter. Leavers' accounts are disabled on the last working day by 6:00 pm.

### 6.3 Asset management

All hardware and cloud assets are recorded in the asset inventory with a named owner. Laptops must be encrypted and managed as defined in the *Laptop and Device Security Standard*.

### 6.4 Vulnerability and patch management

| Severity (CVSS) | Remediation deadline |
|---|---|
| Critical (9.0–10.0) | 7 days |
| High (7.0–8.9) | 30 days |
| Medium (4.0–6.9) | 90 days |
| Low (below 4.0) | Next planned maintenance |

Internet-facing systems are scanned weekly; NimbusOps undergoes an external penetration test twice a year.

### 6.5 Logging and monitoring

Security logs from identity, endpoints, cloud and network systems are sent to the SOC's SIEM and retained for **1 year online and 180 days in archive** beyond that, meeting CERT-In's 180-day log retention direction.

### 6.6 Business continuity

Critical services have documented recovery objectives. For NimbusOps, the targets are RPO 15 minutes and RTO 1 hour, tested by a DR drill at least twice a year.

### 6.7 Supplier security

Vendors that process Confidential or Restricted data complete a security assessment before onboarding and sign a data processing agreement. High-risk vendors are reassessed every year.

### 6.8 Incident management

All suspected security incidents must be reported through the *Incident Reporting Procedure*. Incidents are classified SEV1 to SEV4. Incidents reportable under CERT-In directions are reported to CERT-In within 6 hours of being noticed.

## 7. Compliance and exceptions

- Exceptions to any security policy are requested in the ServiceDesk *Security Exception* form, need CISO approval, and are valid for a maximum of 6 months.
- Internal audit checks compliance every year; ISO 27001 surveillance audits take place annually.
- Breaches of this policy may lead to disciplinary action under the *Code of Conduct*.

## 8. Review

The CISO reviews this policy at least once a year, or sooner after a major incident or regulatory change, and presents changes to the Steering Committee.
