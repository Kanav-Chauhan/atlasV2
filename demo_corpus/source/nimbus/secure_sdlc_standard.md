---
title: Secure SDLC Standard
access: Engineering
format: pdf
doc_no: NIM/ENG/STD-005
version: 2.1
effective: 01 April 2026
review: 31 March 2027
classification: Internal
department: Information Security
prepared_by: Sameer Khan, Chief Information Security Officer
approved_by: Meera Iyer, Chief Technology Officer
stamp: APPROVED
---
# Secure SDLC Standard

## 1. Purpose

This standard builds security into every phase of software development at Nimbus Infotech. It supports our ISO 27001:2022 certification (Annex A controls 8.25 to 8.29), the SOC 2 Type II report for NimbusOps, and security commitments in client contracts.

## 2. Scope

All software developed by Nimbus employees and contractors: NimbusOps, internal tools, and client deliverables. Where a client contract specifies stricter requirements, the contract prevails.

## 3. Roles

| Role | Responsibility |
|---|---|
| CISO (Sameer Khan) | Owns this standard, approves exceptions, accepts residual risk above Medium |
| Application Security team (ITS) | Tooling, threat-model facilitation, penetration test management, triage support |
| Security Champion (one per team, L3 or above) | First line review, keeps the team's threat models current, attends monthly champion forum |
| Engineering Manager | Ensures the team meets remediation SLAs |
| Developer | Follows secure coding guidelines, fixes findings |

## 4. Lifecycle requirements

### 4.1 Plan and design

1. Every new service, major feature, or change touching authentication, authorisation, tenant isolation, payments or personal data needs a **threat model** (STRIDE) before development starts.
2. Threat models are recorded in the repository under `docs/threat-model.md` and reviewed by the Security Champion and AppSec. Turnaround from AppSec: 5 business days.
3. Data processing of personal data is checked against the Data Protection Policy and the DPDP Act 2023; a privacy review is required when new categories of personal data are collected.

### 4.2 Build

- Follow the OWASP ASVS Level 2 requirements for web applications and APIs.
- Use approved libraries for cryptography, authentication and input validation. Custom crypto is forbidden.
- Secrets are fetched from AWS Secrets Manager or Azure Key Vault at runtime. No secrets in code, config files, container images or CI variables in plain text.
- Third-party components must be on the approved licence list (MIT, Apache-2.0, BSD, ISC, MPL-2.0). GPL/AGPL components require Legal approval.

### 4.3 Verify

| Activity | Tool | When | Gate |
|---|---|---|---|
| Static analysis (SAST) | Semgrep | Every PR | No new Critical/High |
| Software composition analysis (SCA) | Dependabot, Trivy | Every PR + daily | No new Critical |
| Secrets scanning | Gitleaks (pre-commit + CI) | Every commit | Block |
| Container image scanning | Trivy | Every build | No Critical with a fix available |
| Infrastructure as code scanning | Checkov | Every PR | No High |
| Dynamic testing (DAST) | OWASP ZAP | Weekly on staging; before each major release | No High |
| Penetration test | Independent CERT-In empanelled firm | Annually, and before launch of a major new product | Report reviewed by CISO |

### 4.4 Release

- Production releases must pass all gates above. Releases follow the Release and Rollback Procedure (NIM/ENG/SOP-002).
- Container images are signed (Cosign) and only signed images from the Nimbus registry can run in production clusters (admission policy enforced by Kyverno).
- An SBOM (CycloneDX) is generated for every release and stored for 3 years.

### 4.5 Operate

- Vulnerabilities reported externally go to `security@nimbus.example`; the response is acknowledged within 2 business days.
- Production access is just-in-time, limited to 8 hours, and logged.

## 5. Vulnerability remediation SLAs

Remediation time is counted from the date the finding is confirmed.

| Severity (CVSS v3.1) | Internet-facing systems | Internal systems |
|---|---|---|
| Critical (9.0–10.0) | **7 days** | 15 days |
| High (7.0–8.9) | **30 days** | 45 days |
| Medium (4.0–6.9) | 90 days | 120 days |
| Low (0.1–3.9) | 180 days | Next planned release |

If a Critical vulnerability is actively exploited in the wild (listed in the CISA KEV catalogue or flagged by CERT-In), the target is **72 hours** and the CISO may order an emergency release.

## 6. Exceptions and risk acceptance

If a finding cannot be fixed within its SLA, the Engineering Manager raises a risk exception in the GRC tool with compensating controls and a target date.

| Severity | Can be accepted by | Maximum exception period |
|---|---|---|
| Critical | CISO and CTO jointly | 30 days |
| High | CISO | 90 days |
| Medium / Low | Engineering Manager with Security Champion | 180 days |

## 7. Training

- All engineers complete secure coding training (OWASP Top 10, 3 hours) within 30 days of joining and annually thereafter.
- Security Champions complete an additional 16-hour programme and attend at least 9 of 12 monthly forums per year.
- Completion is tracked by People Operations; engineers more than 30 days overdue lose production access until complete.

## 8. Metrics (reported monthly to the CISO and CTO)

| Metric | FY27 target |
|---|---|
| Critical/High findings past SLA | 0 |
| Services with current threat model (< 12 months) | 100% |
| Mean time to remediate High (internet-facing) | ≤ 20 days |
| Engineers with current secure coding training | ≥ 98% |

## 9. Client deliverables

For client projects, the Delivery Manager confirms at project kick-off which client security requirements apply, records them in the project's security plan, and ensures SAST, SCA and secrets scanning run in the client's or Nimbus's pipeline. Penetration tests on client systems are performed only with written client authorisation.

## 10. Non-compliance

Bypassing security gates without an approved exception is a disciplinary matter under the Code of Conduct. Repeated non-compliance by a team is reported to the CTO.
