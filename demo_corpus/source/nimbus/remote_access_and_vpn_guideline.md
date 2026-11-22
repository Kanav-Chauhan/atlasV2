---
title: Remote Access and VPN Guideline
access: Everyone
format: docx
doc_no: NIM/ITS/GDL-001
version: 2.0
effective: 01 April 2026
review: 31 March 2027
classification: Internal
department: Information Security
prepared_by: Pradeep Joshi, Head of Infrastructure & SRE
approved_by: Sameer Khan, Chief Information Security Officer
stamp: APPROVED
---
# Remote Access and VPN Guideline

## 1. Purpose

Nimbus works in a hybrid model, with 3 office days a week. This guideline explains how to connect securely to Nimbus and client systems when you are not in the office, which tool to use for which system, and what to do when something does not work.

## 2. Scope

All employees and contractors using Nimbus-issued laptops to reach internal applications, development environments, client networks or NimbusOps infrastructure from outside a Nimbus office network.

## 3. Which access method to use

| What you need | Access method | Notes |
|---|---|---|
| Email, Slack, Google Drive, HRMS, Atlas | Direct over the internet via SSO + MFA | No VPN needed |
| Internal apps (Jira, Confluence, GitHub Enterprise, ServiceDesk) | Zero-trust access client (always on) | Device must be compliant |
| Nimbus corporate network resources (file shares, build servers) | Nimbus VPN – "Corp" profile | Full tunnel |
| Client networks | Client-provided VPN or VDI, as defined in the project's access plan | Only from Nimbus laptop |
| NimbusOps production (AWS) | Privileged access gateway, just-in-time | Max 8 hours, ticket required |
| Office network gear, NOC tools | Nimbus VPN – "Ops" profile | Restricted to Managed Services and SRE |

## 4. Nimbus VPN

### 4.1 Requirements

1. A Nimbus-managed laptop that passes the device compliance check (encryption on, EDR reporting, OS patched).
2. SSO login with MFA. Push with number matching or a FIDO2 key is required for each new VPN session.
3. VPN client version pushed by device management. Do not install other VPN clients.

### 4.2 Session rules

| Setting | Value |
|---|---|
| Idle timeout | 30 minutes |
| Maximum session length | 12 hours, then re-authenticate |
| Split tunnelling | Disabled on the Corp and Ops profiles |
| Concurrent sessions per user | 1 |
| Gateways | Pune (primary), Hyderabad (secondary), automatic failover |

### 4.3 Connecting from abroad

VPN connections from outside India are blocked by default. If you are travelling on business, raise a ServiceDesk request at least 3 working days before departure with the country and dates; the SOC enables access for that period. Connections from countries on Nimbus's high-risk list are not allowed under any circumstances.

## 5. Working from public places

- Use the VPN or zero-trust client on any network you do not control: hotels, airports, cafés, co-working spaces.
- Prefer your phone's hotspot over open public Wi-Fi.
- Use a privacy screen and keep calls on Confidential matters to private rooms.
- Never use a public or shared computer to access Nimbus systems.

## 6. Client remote access

1. Each project has an access plan, owned by the delivery manager, listing which client systems the team may reach and how.
2. Client VPN credentials are personal; never share them across the team.
3. Remove client VPN profiles from your laptop within 5 working days of leaving the project.
4. Where a client requires VDI, do not copy data out of the VDI session; clipboard and file transfer are normally disabled.

## 7. Home network hygiene

We recommend, and the SOC may check during audits of high-risk roles, that home routers:

- Run current firmware and have the default admin password changed.
- Use WPA2 or WPA3 encryption with a strong passphrase.
- Separate smart-home devices on a guest network where possible.

Internet costs for working from home are reimbursed up to ₹1,000 per month, as described in the *Employee Benefits Guide*.

## 8. Troubleshooting

| Problem | First step | If still failing |
|---|---|---|
| VPN says "device not compliant" | Open the device management app and run *Sync*; restart after updates | ServiceDesk ticket, category *VPN* |
| MFA prompt not arriving | Check phone time sync; use TOTP code as backup | Call ext. 4357 |
| Slow connection on VPN | Run the speed test page; check you are on the nearest gateway | Ticket with speed test result |
| Client VPN not working | Contact the client's helpdesk per the access plan | Inform your delivery manager |

The ServiceDesk targets a 1-hour response for VPN issues during business hours (9:00 am to 9:00 pm IST); after hours, the SOC on extension 7000 handles access issues blocking SEV1 or SEV2 incident work.

## 9. Monitoring

VPN and zero-trust access logs are sent to the SOC's SIEM. The SOC alerts on simultaneous logins from distant locations, logins at unusual hours combined with large downloads, and repeated failed MFA prompts.

## 10. Related documents

- Information Security Policy
- Password and MFA Standard
- Laptop and Device Security Standard
- Hybrid Work Policy
