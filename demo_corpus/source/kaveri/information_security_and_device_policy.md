---
title: Information Security and Device Policy
access: Everyone
format: docx
doc_no: KCA/OPS/POL-021
version: 2.3
effective: 01 May 2026
review: 30 April 2027
classification: Internal
department: Technology and Operations
prepared_by: Karthik Subramanian, Chief Information Security Officer
approved_by: Mohit Arora, Head of Operations
stamp: APPROVED
---
# Information Security and Device Policy

## 1. Purpose

Kaveri Capital holds sensitive client data (PAN, Aadhaar-linked KYC records, bank details, portfolio holdings) and price-sensitive information about its own trades. This policy sets the rules for protecting that information on Company systems and devices. It supports our obligations under the SEBI Cybersecurity and Cyber Resilience Framework and the Digital Personal Data Protection Act, 2023.

## 2. Scope

All employees, contractors and interns, all Company-issued devices, and any personal device used to access Company email or applications.

## 3. Information classification

| Class | Examples | Handling |
|---|---|---|
| Public | Factsheets, website content | No restriction |
| Internal | Handbook, HR policies, internal notices | Do not share outside the Company |
| Confidential | Research notes, IC minutes, financials, client lists | Need-to-know; encrypted in transit; no personal email |
| Restricted | Client KYC data, UPSI, passwords, unpublished trades | Named access only; no printing without approval; DLP-monitored |

## 4. Company devices

4.1 Every employee receives a Company laptop with full-disk encryption (BitLocker), endpoint detection and response (EDR) and the device-management agent installed. These must not be disabled.

4.2 Laptops lock automatically after **5 minutes** of inactivity.

4.3 USB mass-storage ports are blocked by default. Exceptions require CISO approval and are valid for a maximum of **30 days**.

4.4 Lost or stolen devices must be reported to the IT service desk (extension 4400) within **2 hours** of discovery; IT will remote-wipe the device.

4.5 Devices are refreshed every **4 years**. Equipment must be returned on the last working day; final settlement is held until it is returned.

## 5. Personal devices (BYOD)

| Permitted | Not permitted |
|---|---|
| Company email and Teams via the managed mobile app | Downloading client data to the phone's local storage |
| Viewing internal documents in the managed app | Copy-paste from managed apps to personal apps |
| Two-factor authentication app | Jail-broken or rooted phones |

Personal laptops may not be used to access Company systems except via the virtual desktop, with CISO approval.

## 6. Passwords and authentication

- Minimum 14 characters; no reuse of the last 10 passwords.
- Multi-factor authentication (MFA) is mandatory for email, VPN, the order management system (OMS) and Atlas.
- Privileged accounts (administrators, OMS supervisors) use hardware security keys and are reviewed every quarter.
- Passwords must never be shared, including with IT staff.

## 7. Dealing room controls

7.1 The Mumbai dealing room is a **recorded zone**. All dealer phone lines are recorded and recordings are retained for **8 years**.

7.2 Personal mobile phones must be deposited in the lockers at the dealing room entrance between 9:00 am and 3:30 pm on trading days.

7.3 Orders may be received only through the OMS or recorded lines. Orders received on WhatsApp or personal email are not valid.

## 8. Email, internet and AI tools

- Auto-forwarding of Company email to external addresses is blocked.
- Client data must not be uploaded to public file-sharing sites or public AI chat tools.
- Only AI tools approved by the CISO (including Atlas, the internal document-Q&A tool) may be used with Confidential or Restricted information.
- Email attachments containing client data must be password-protected; the password is sent through a separate channel.

## 9. Data retention

| Record | Minimum retention |
|---|---|
| Client KYC records | 8 years after end of relationship |
| Trade records and order logs | 8 years |
| Dealer voice recordings | 8 years |
| Email | 8 years |
| CCTV footage (offices) | 90 days |
| System access logs | 2 years online, 8 years archived |

## 10. Incident reporting

10.1 Report any suspected security incident (phishing click, lost device, data sent to the wrong person, unusual system behaviour) to the IT service desk **immediately**, and in any case within 1 hour.

10.2 The CISO classifies incidents as P1 to P4. P1 incidents (client data breach, trading system compromise) are escalated to the MD & CEO and CRO within 1 hour and reported to CERT-In within **6 hours**, as required by law.

10.3 Use the "Report Phishing" button in Outlook for suspicious emails. Do not forward them.

## 11. Training and testing

- Security awareness training at joining and annually; the quiz pass mark is **80%**.
- Quarterly phishing simulations. Employees who click in two consecutive simulations must repeat training within 15 days.
- In FY2025-26 the phishing click rate fell from 11.2% (Q1) to 4.6% (Q4).

## 12. Access management

| Activity | Timeline |
|---|---|
| New joiner access | Provisioned on Day 1 against HR-approved request |
| Role change | Old access removed within 3 working days |
| Leaver | All access revoked by end of last working day |
| User access review | Quarterly for OMS and fund accounting; half-yearly for others |

## 13. Breaches

Violations of this policy are handled under the Code of Conduct and Ethics. Deliberate exfiltration of client data or UPSI is gross misconduct.
