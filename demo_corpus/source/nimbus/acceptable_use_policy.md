---
title: Acceptable Use Policy
access: Everyone
format: pdf
doc_no: NIM/ITS/POL-002
version: 4.1
effective: 01 April 2026
review: 31 March 2027
classification: Internal
department: Information Security
prepared_by: Sameer Khan, Chief Information Security Officer
approved_by: Meera Iyer, Chief Technology Officer
stamp: APPROVED
---
# Acceptable Use Policy

## 1. Purpose

This policy describes what you may and may not do with Nimbus IT resources: laptops, phones, accounts, networks, cloud services, software and data. It protects you, Nimbus and our clients.

## 2. Scope

Applies to every person who uses a Nimbus-issued device or account, including contractors and interns, wherever they work.

## 3. General principles

1. Nimbus IT resources are provided for business purposes.
2. **Limited personal use** is allowed (for example, checking personal email or banking during breaks) provided it does not interfere with work, consume significant bandwidth, or break any rule in this policy.
3. Nimbus may monitor use of its systems for security, compliance and troubleshooting. Monitoring is carried out by the SOC under the CISO's authority and in line with the *Data Protection Policy – DPDP Act 2023*.

## 4. Accounts and credentials

- Use only your own account. Never share passwords, MFA codes or session tokens, including with your manager or IT staff. IT will never ask for your password.
- Follow the *Password and MFA Standard*: passwords of at least 14 characters and MFA on every account.
- Store secrets for code and infrastructure only in the approved secrets manager, never in code, tickets, wikis or chat.

## 5. Email and collaboration

| Allowed | Not allowed |
|---|---|
| Business communication on Nimbus email, Slack, Teams (for client meetings) | Auto-forwarding Nimbus email to personal accounts |
| Sharing files through Nimbus Google Drive / SharePoint with named people | "Anyone with the link" sharing for Internal, Confidential or Restricted files |
| Joining client collaboration tools when the client invites you | Creating unofficial Slack or WhatsApp groups to share client data |
| Reporting suspicious mail to phish@nimbus.example | Clicking links or opening attachments you were not expecting |

## 6. Internet use

Nimbus filters web traffic. The following categories are blocked: malware, gambling, adult content, piracy and torrent sites, anonymising proxies and unapproved file-sharing services. Requests to unblock a business site are raised in the ServiceDesk and decided by the SOC within 1 working day.

## 7. Software

1. Install only software from the Nimbus Software Centre or the approved list on the intranet.
2. Developers may install open-source packages from official registries (npm, PyPI, Maven Central) for project work, subject to the dependency rules in the Secure SDLC Standard.
3. Pirated or unlicensed software is strictly prohibited.
4. Browser extensions are restricted to the allow-list pushed by device management.

## 8. Generative AI tools

| Tool category | Status | Data allowed |
|---|---|---|
| Nimbus enterprise AI assistant (company tenant) | Approved | Up to Confidential |
| Approved AI coding assistant in company IDE licence | Approved | Nimbus code; client code only if the client contract permits |
| Atlas (internal document Q&A) | Approved | Content you already have access to |
| Public consumer chatbots on personal accounts | Not approved for work | Public information only |

Never paste client data, personal data, credentials or Restricted information into an unapproved AI tool. If unsure, ask the SOC.

## 9. Removable media and printing

- USB storage devices are blocked on Nimbus laptops by default. Exceptions require CISO approval and a Nimbus-issued encrypted drive.
- Printing of Confidential or Restricted documents must use secure "follow-me" printing in the office; printouts must be shredded after use.

## 10. Client environments

When you work in a client environment you must also follow the client's acceptable use rules. If the client's rules are stricter, they apply. Never connect a personal device to a client network.

## 11. Personal devices (BYOD)

Personal phones may be used for Nimbus email, Slack and MFA only after enrolling them in the mobile device management (MDM) work profile. Personal laptops and tablets may not be used to access Nimbus or client systems, except the webmail portal for Public and Internal information.

## 12. Prohibited activities

The following are prohibited and may lead to termination:

1. Attempting to bypass security controls (disabling endpoint protection, VPN split-tunnelling tricks, proxy evasion).
2. Scanning, probing or testing networks without a written authorisation from the CISO.
3. Cryptocurrency mining on any Nimbus or client resource.
4. Storing or sending offensive, harassing or illegal content.
5. Using Nimbus resources for personal commercial activity.
6. Copying Nimbus or client data to personal storage or personal cloud accounts.

## 13. Lost or stolen devices

Report a lost or stolen device to the ServiceDesk (extension 4357) or security@nimbus.example **within 1 hour** of noticing. IT will remotely lock and wipe the device. A police report (FIR) copy is required within 3 days for theft.

## 14. Violations

Suspected violations are investigated by the SOC and reviewed with People Operations. Consequences follow the disciplinary procedure under the *Code of Conduct*.

## 15. Acknowledgement

All users accept this policy at first login and re-accept it every year during the security awareness training, which must be completed by 30 September.
