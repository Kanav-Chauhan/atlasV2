---
title: Data Classification and Handling Policy
access: Everyone
format: pdf
doc_no: NIM/ITS/POL-003
version: 3.2
effective: 01 April 2026
review: 31 March 2027
classification: Internal
department: Information Security
prepared_by: Sameer Khan, Chief Information Security Officer
approved_by: Meera Iyer, Chief Technology Officer
stamp: APPROVED
---
# Data Classification and Handling Policy

## 1. Purpose

Not all information needs the same protection. This policy defines four classification levels, explains how to decide which level applies, and sets the handling rules for each level throughout its life: creation, storage, sharing, transfer, retention and disposal.

## 2. Scope

All information created, received or processed by Nimbus in any form: documents, source code, databases, emails, chat messages, recordings and paper. It covers Nimbus's own information and information entrusted to us by clients.

## 3. Classification levels

| Level | Definition | Examples |
|---|---|---|
| **Public** | Approved for release outside Nimbus; no harm if disclosed | Website content, published case studies, job adverts, NimbusOps marketing material |
| **Internal** | For Nimbus staff and authorised contractors; limited harm if disclosed | Company Handbook, org charts, internal announcements, most policies |
| **Confidential** | Serious harm to Nimbus, clients or individuals if disclosed | Client source code and data, proposals, pricing, architecture of client systems, employee personal data |
| **Restricted** | Severe harm; access limited to named individuals | Salary bands and individual compensation, board papers, M&A, cryptographic keys, production credentials, sensitive personal data such as health records |

If you are unsure, classify one level higher and ask the information owner.

## 4. Who classifies

1. The **information owner** (author or the business owner of the system) assigns the classification when the information is created.
2. Client information is classified **Confidential at minimum**, or Restricted where the client contract or the nature of the data (for example, health data handled for Al Noor Healthcare) requires it.
3. Documents must show the classification in the header or footer; Atlas and the document templates do this automatically.
4. Owners review the classification when the document is revised, and at least every 2 years.

## 5. Handling rules

### 5.1 Storage

| Level | Allowed storage |
|---|---|
| Public | Any Nimbus system |
| Internal | Nimbus Google Drive / SharePoint, Confluence, Atlas |
| Confidential | Access-controlled project folders, client-approved repositories; encrypted at rest |
| Restricted | Named-access folders with access logging; encrypted at rest with Nimbus-managed keys; never on local disk outside an encrypted container |

### 5.2 Sharing and transmission

| Level | Inside Nimbus | Outside Nimbus |
|---|---|---|
| Public | Free | Free |
| Internal | Any employee | Only under NDA, with manager approval |
| Confidential | Need-to-know only | Under NDA or contract; encrypted transfer (SFTP, secure share links with expiry of 14 days or less) |
| Restricted | Named individuals approved by owner | Only with CISO approval; encrypted end-to-end; recipient listed in the transfer log |

Email: Confidential attachments sent outside Nimbus must be in a secure share link, not attached directly. Restricted information must never be sent by email, even internally; share a link to the controlled folder instead.

### 5.3 Printing and paper

- Internal: print as needed; do not leave on printers.
- Confidential: follow-me printing only; store in locked drawers; shred after use.
- Restricted: printing only with owner approval; numbered copies; shred in the office cross-cut shredder and record destruction.

### 5.4 Use in non-production environments

Production personal data and client data must not be copied into development or test environments. Use synthetic or masked data. Exceptions require written client consent and CISO approval.

### 5.5 Generative AI

Confidential and Restricted information may only be used with the approved AI tools listed in the *Acceptable Use Policy*, within the data levels shown there.

## 6. Retention and disposal

| Record type | Retention period |
|---|---|
| Client project data | As per contract; default: returned or deleted within 30 days of contract end |
| Financial and accounting records | 8 years (Companies Act) |
| Employee records | 7 years after exit |
| Security logs | 1 year online plus 180 days archive |
| Recruitment records of unsuccessful candidates | 1 year |
| NimbusOps customer telemetry | 13 months, then deleted |

Disposal must be secure: crypto-shredding or NIST 800-88 wiping for electronic media, cross-cut shredding for paper. Deletion of client data at contract end is confirmed to the client in writing by the delivery manager.

## 7. Labelling in Atlas and document tools

Atlas collections are mapped to classification levels and access groups. For example, the *Compensation* collection is Restricted and visible only to HR. Do not upload documents into a collection whose access group is wider than the document's classification allows.

## 8. Incidents

Any suspected disclosure of Confidential or Restricted information to an unauthorised person is a security incident and must be reported under the *Incident Reporting Procedure* immediately.

## 9. Responsibilities

| Role | Responsibility |
|---|---|
| Information owners | Classify, approve access, review |
| Employees | Handle data according to its label |
| Delivery managers | Apply client-specific handling rules on their projects |
| CISO | Own this policy, approve exceptions |
| SOC | Data loss prevention monitoring |

## 10. Non-compliance

Mishandling of Confidential or Restricted information may result in disciplinary action, up to termination, in line with the *Code of Conduct*.
