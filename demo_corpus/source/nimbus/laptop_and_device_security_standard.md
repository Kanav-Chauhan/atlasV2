---
title: Laptop and Device Security Standard
access: Everyone
format: docx
doc_no: NIM/ITS/STD-002
version: 2.4
effective: 01 April 2026
review: 31 March 2027
classification: Internal
department: Information Security
prepared_by: Pradeep Joshi, Head of Infrastructure & SRE
approved_by: Sameer Khan, Chief Information Security Officer
stamp: APPROVED
---
# Laptop and Device Security Standard

## 1. Purpose

This standard sets the minimum security configuration for every laptop, desktop and mobile device used for Nimbus work, and explains what users must do to keep their devices safe.

## 2. Scope

- Nimbus-issued Windows laptops and desktops.
- Nimbus-issued macOS laptops.
- Personal and company mobile phones enrolled for Nimbus email, Slack or MFA.
- Client-issued laptops follow the client's standard; where that standard is weaker than this one, raise it with the CISO.

## 3. Standard laptop configurations

| Item | Windows | macOS |
|---|---|---|
| Default model (L1–L4) | 16 GB RAM, 512 GB SSD | MacBook Air, 16 GB RAM |
| Developer / data model | 32 GB RAM, 1 TB SSD | MacBook Pro, 32 GB RAM |
| Refresh cycle | 4 years | 4 years |
| Disk encryption | BitLocker (XTS-AES 256, TPM + PIN) | FileVault 2 |
| Device management | Intune | Jamf |

## 4. Mandatory security controls

### 4.1 Encryption

All laptop drives must be fully encrypted with **BitLocker** (Windows) or **FileVault** (macOS) before the device is handed to the user. Recovery keys are escrowed in the device management console; users never hold their own recovery key.

### 4.2 Screen lock

- Screens **auto-lock after 5 minutes** of inactivity. This setting is enforced and cannot be changed by users.
- Lock your screen manually (Windows+L, or Ctrl+Cmd+Q) whenever you step away, even for a moment.
- Unlock requires password, PIN or biometric (Windows Hello / Touch ID).

### 4.3 Endpoint protection

| Control | Setting |
|---|---|
| EDR agent | Installed and reporting; tampering raises a SEV3 security alert |
| Host firewall | On, managed policy |
| OS updates | Security patches installed within 7 days of release; device forced to restart after 10 days |
| Browser | Chrome or Edge managed builds, auto-update on |
| Local admin rights | Removed; elevation on request through the privilege management tool for 30 minutes |
| USB storage | Blocked by default |
| Bluetooth file transfer | Disabled |

### 4.4 Compliance checks

Device management checks compliance every 4 hours. A non-compliant device (encryption off, EDR not reporting, OS more than 30 days out of date) loses access to email, VPN and SSO apps until it is fixed.

## 5. Mobile devices

1. Phones used for Nimbus apps must run a supported OS version (Android 13+ or iOS 17+).
2. A 6-digit PIN or biometric lock is required, with auto-lock no longer than 2 minutes.
3. Nimbus apps run inside the MDM work profile; Nimbus can wipe the work profile but not personal data.
4. Rooted or jail-broken devices are blocked.

## 6. User responsibilities

- Never leave your laptop unattended in a vehicle, café or airport.
- Use a privacy screen when working on Confidential or Restricted data in public places, including flights and trains.
- Carry the laptop as hand baggage when flying.
- Do not let family members or anyone else use your Nimbus laptop.
- Connect to public Wi-Fi only with the VPN on (see the *Remote Access and VPN Guideline*).
- Keep the laptop in the office drawer pedestal or take it home; do not leave it on the desk overnight.

## 7. Loss, theft or damage

| Event | Action | Deadline |
|---|---|---|
| Lost or stolen device | Report to ServiceDesk (ext. 4357) or security@nimbus.example | Within 1 hour |
| Theft | File a police complaint and upload the FIR copy | Within 3 days |
| Accidental damage | Raise ServiceDesk ticket; loaner issued same day where possible | Within 24 hours |

IT remotely locks and wipes lost devices. The first loss in 4 years is not charged to the employee. A second loss caused by negligence may be recovered at the depreciated value of the device, as decided by the CISO and Chief People Officer.

## 8. Device return and disposal

- On exit, laptops and accessories must be returned to IT on or before the last working day; the asset clearance in the exit checklist depends on it.
- Returned devices are wiped with a NIST 800-88 compliant method before reissue.
- Devices at end of life are destroyed by a certified e-waste vendor, who provides a certificate of destruction recorded against the asset tag.

## 9. Exceptions

Exceptions (for example, a Linux workstation for a specific project) need CISO approval through the ServiceDesk *Security Exception* form, valid for up to 6 months, and the device must meet equivalent encryption, lock and EDR controls.

## 10. Ownership

This standard is owned by the Head of Infrastructure & SRE and approved by the CISO. Questions: it-security@nimbus.example.
