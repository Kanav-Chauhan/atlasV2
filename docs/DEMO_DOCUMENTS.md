# Atlas v2 — demo documents, users and questions

Written 2026-11-22. Source: the old repo `atlas-rag-platform` (read-only):
`demo_corpus/SPEC.md`, `demo_corpus/bibles/*.md`, the front matter of every file in
`demo_corpus/source/`, `services/api/scripts/seed.py` (old users and who-sees-what) and
`evals/demo_v1.json` (eval questions and which user asks them).

## How to read this

- **Old collection** comes from the `collection:` line in each document's front matter. In
  the old app, users were in groups and groups were granted collections (`seed.py`).
- **New department** is where the document lives in v2 (departments exactly as PLAN.md §4).
- **Everyone** = all staff, including Guests. **Public** = the website chat may answer from it.
  A Public document still lives in its department (or Everyone) for staff.
- **Public?** is "yes" only for things safe on a company website: company/office info,
  product FAQs and factsheets, refund/service policies, careers info.
- Old document file names are the snake_case of the title (e.g. `leave_policy_fy2026_27.md`);
  the rendered PDF/DOCX/MD is in `demo_corpus/build/<company>/`.
- **Assumption:** the Admin (company owner) is given every department, like the old owner
  who could read every collection that mattered. Change this if Admin should see less.
- Rule kept from the old corpus: the eval's permission tests (`denied_as`) must still fail
  for the denied user. Every mapping below was checked against them; the few evals whose
  asking user changes are listed per company.

---

## 1. Nimbus Infotech (IT services)

### 1.1 Departments

| Department | What lives here |
|---|---|
| HR | Performance review, salary bands, variable pay, merit, relocation |
| Engineering | Runbooks, architecture and standards, client project delivery, BRDs, design docs |
| Product | NimbusOps product docs (all new) |
| Finance | Finance policies and reports (all new) |
| Legal | Contracts and contract rules (all new) |
| Sales | Proposals, rate card, discount rules, renewal notes |
| IT Security | Security team's own procedures (all new) |
| Leadership | Board minutes, budget, annual financials, campus expansion |
| *Everyone* | Handbook, IT and security rules every employee must follow, leave and exit rules |
| *Public* | Company welcome page, NimbusOps product FAQ |
| *Managers (proposed extra)* | Manager playbooks — see the open question below |

**Open question (owner): Manager Playbooks.** In the old app they were readable by a
"Managers" group (Neha Gupta and Ritika Menon). They fit none of the 8 departments without
breaking an old permission test: in HR, Neha would see salary bands (test: Neha must NOT see
Variable Pay Plan); in Engineering, Aditya would see the PIP guide (test: Aditya must NOT
see it); in Leadership, Neha would see board minutes (test: Neha must NOT see them).
**Recommendation:** add one extra department "Managers" (admins can create departments
freely). **Fallback:** put them in HR and re-point the 2 Manager-Playbook evals to Ritika.

### 1.2 Existing documents (58)

| # | Title | Type | Old collection | New department | Public? |
|---|---|---|---|---|---|
| 1 | Welcome to Nimbus | MD | Company Handbook | Everyone | **Yes** |
| 2 | Code of Conduct | PDF | Company Handbook | Everyone | No |
| 3 | Hybrid Work Policy | PDF | Company Handbook | Everyone | No |
| 4 | Travel and Expense Policy | PDF | Company Handbook | Everyone | No |
| 5 | Holiday Calendar FY2026-27 | DOCX | Company Handbook | Everyone | No |
| 6 | Employee Benefits Guide | PDF | Company Handbook | Everyone | No |
| 7 | POSH Policy – Prevention of Sexual Harassment | PDF | Company Handbook | Everyone | No |
| 8 | Information Security Policy | PDF | IT & Security Policies | Everyone | No |
| 9 | Acceptable Use Policy | PDF | IT & Security Policies | Everyone | No |
| 10 | Password and MFA Standard | PDF | IT & Security Policies | Everyone | No |
| 11 | Laptop and Device Security Standard | DOCX | IT & Security Policies | Everyone | No |
| 12 | Data Classification and Handling Policy | PDF | IT & Security Policies | Everyone | No |
| 13 | Incident Reporting Procedure | PDF | IT & Security Policies | Everyone | No |
| 14 | Remote Access and VPN Guideline | DOCX | IT & Security Policies | Everyone | No |
| 15 | Data Protection Policy – DPDP Act 2023 | PDF | IT & Security Policies | Everyone | No |
| 16 | Leave Policy FY2026-27 | PDF | HR Policies | Everyone *(changed: was HR only)* | No |
| 17 | Leave Policy FY2024-25 (SUPERSEDED by #16) | PDF | HR Policies | Everyone *(changed)* | No |
| 18 | Notice Period and Exit Process | PDF | HR Policies | Everyone *(changed)* | No |
| 19 | Referral Bonus Policy | PDF | HR Policies | Everyone *(changed)* | No |
| 20 | Performance Review Process | DOCX | HR Policies | HR | No |
| 21 | Salary Bands FY2026-27 | PDF | Compensation | HR | No |
| 22 | Merit Increase Guidelines FY27 | DOCX | Compensation | HR | No |
| 23 | Variable Pay Plan | PDF | Compensation | HR | No |
| 24 | Relocation Assistance Policy | PDF | Compensation | HR | No |
| 25 | New Joiner Onboarding Checklist | MD | Manager Playbooks | Managers (proposed) | No |
| 26 | Running Effective 1:1s | MD | Manager Playbooks | Managers (proposed) | No |
| 27 | Handling Performance Issues – PIP Guide | DOCX | Manager Playbooks | Managers (proposed) | No |
| 28 | Hiring Approval Workflow | PDF | Manager Playbooks | Managers (proposed) | No |
| 29 | Managing Attrition and Retention (DRAFT) | DOCX | Manager Playbooks | Managers (proposed) | No |
| 30 | NimbusOps Database Failover Runbook | MD | Engineering Runbooks | Engineering | No |
| 31 | Kafka Consumer Lag Runbook | MD | Engineering Runbooks | Engineering | No |
| 32 | Kubernetes Node Pressure Runbook | MD | Engineering Runbooks | Engineering | No |
| 33 | SEV1 Incident Response Runbook | MD | Engineering Runbooks | Engineering | No |
| 34 | Certificate Renewal Runbook | MD | Engineering Runbooks | Engineering | No |
| 35 | Disaster Recovery Drill Procedure | PDF | Engineering Runbooks | Engineering | No |
| 36 | On-Call Policy and Rotation | PDF | Engineering Runbooks | Engineering | No |
| 37 | Release and Rollback Procedure | DOCX | Engineering Runbooks | Engineering | No |
| 38 | NimbusOps Platform Architecture | PDF | Architecture & Standards | Engineering | No |
| 39 | API Design Standard | PDF | Architecture & Standards | Engineering | No |
| 40 | Code Review Standard | DOCX | Architecture & Standards | Engineering | No |
| 41 | Cloud Cost Management Guideline | PDF | Architecture & Standards | Engineering | No |
| 42 | Logging and Observability Standard | DOCX | Architecture & Standards | Engineering | No |
| 43 | Secure SDLC Standard | PDF | Architecture & Standards | Engineering | No |
| 44 | Harbor Logistics – Account Overview | DOCX | Client Projects | Engineering | No |
| 45 | Harbor Logistics – Cloud Migration Status Report Q1 FY27 | PDF | Client Projects | Engineering | No |
| 46 | Zenith Retail – SAP S/4HANA Project Charter | PDF | Client Projects | Engineering | No |
| 47 | Al Noor Healthcare – Managed SOC Service Report | PDF | Client Projects | Engineering | No |
| 48 | Crestline Insurance – Data Platform SOW Summary | DOCX | Client Projects | Engineering | No |
| 49 | Harbor Logistics – Incident Post-Mortem INC-2291 | PDF | Client Projects | Engineering | No |
| 50 | Client Escalation Matrix | DOCX | Client Projects | Engineering | No |
| 51 | Proposal – Crestline Insurance Data Platform Phase 2 | PDF | Sales Proposals | Sales | No |
| 52 | Rate Card FY2026-27 | PDF | Sales Proposals | Sales | No |
| 53 | Harbor Logistics Renewal Negotiation Notes (DRAFT) | DOCX | Sales Proposals | Sales | No |
| 54 | Discount Approval Policy | PDF | Sales Proposals | Sales | No |
| 55 | Board Meeting Minutes – 14 May 2026 | PDF | Board & Leadership | Leadership | No |
| 56 | FY2025-26 Annual Financial Summary | PDF | Board & Leadership | Leadership | No |
| 57 | FY2026-27 Budget and Headcount Plan | PDF | Board & Leadership | Leadership | No |
| 58 | Hyderabad Campus Expansion Proposal | DOCX | Board & Leadership | Leadership | No |

Why the changes: the old "Delivery" group (Client Projects) has no v2 department; delivery
is engineering work, so it goes to Engineering. Leave, notice and referral rules move to
Everyone because every employee needs them (Sanjeevani and Kaveri already do this). No old
permission test covers them. The IT & Security policies stay in Everyone because every
employee must follow them; the IT Security department gets its own team documents (new).

**Counts (existing):**

| Department | Docs | Gap? |
|---|---|---|
| Everyone | 19 | |
| HR | 5 | |
| Engineering | 21 | |
| Product | 0 | **GAP** |
| Finance | 0 | **GAP** |
| Legal | 0 | **GAP** |
| Sales | 4 | |
| IT Security | 0 | **GAP** |
| Leadership | 4 | |
| Managers (proposed) | 5 | |
| Public (flag) | 1 | **GAP** (only the welcome page; no product FAQ, no careers info) |
| **Total** | **58** | |

### 1.3 New documents to write (10)

| # | Title | Department | Type | What it says | Must agree with (bible) | Example questions |
|---|---|---|---|---|---|---|
| N1 | BRD – Zenith Retail Omnichannel Inventory Sync | Engineering | DOCX | Business requirements for near-real-time stock visibility across Zenith stores on S/4HANA: problem, goals, requirements, acceptance criteria, sign-off. | Zenith Retail (India, ₹38 crore SAP S/4HANA deal); charter facts: 480 stores, 96 cities, 6 DCs, 34 interfaces, overnight stock refresh today, 3-month hypercare. | "What stock refresh time does the Zenith inventory BRD require?" / "Who signs off the Zenith inventory sync BRD?" |
| N2 | BRD – NimbusOps AI Alert Summaries | Product | DOCX | BRD for an AI feature that groups noisy alerts and writes a plain summary per incident: users, success metrics, which plans get it, rollout. | NimbusOps (~140 customers), plans Starter / Standard / Enterprise, SEV1–SEV4 definitions, SOC 2 Type II, data stays in AWS ap-south-1 (Mumbai). | "Which NimbusOps plans get AI alert summaries?" / "What alert-noise reduction is the AI summaries feature targeting?" |
| N3 | NimbusOps Product FAQ | Product | MD | Website FAQ: what NimbusOps does, plans (names and features, **no prices**), 99.9% availability, data residency, support hours, free trial, how to cancel. | 99.9% monthly SLO, SOC 2 Type II, ISO 27001:2022, Mumbai primary / Hyderabad DR, 24x7 NOC/SOC. **Prices stay only in the Rate Card (Sales).** | "Where is NimbusOps customer data stored?" / "What uptime does NimbusOps promise?" — **Public: yes** |
| N4 | Master Services Agreement – Harbor Logistics Inc. | Legal | PDF | Signed MSA summary: term, renewal date and notice, liability cap, SLAs and service credits, data protection, termination. | Harbor: US client, USD 4.2M/yr, cloud migration + managed service since Oct 2023, AWS us-east-1/us-west-2, **renewal due 30 Sept 2026**. | "What is the liability cap in the Harbor MSA?" / "How much notice is needed to not renew the Harbor contract?" |
| N5 | Contract Review and Signing Authority Guideline | Legal | PDF | Which contracts Legal must review, NDA template rules, who may sign at which value (signing matrix), turnaround times. | People: Vikram Kulkarni (CEO), Rohan Bhatia (CFO), Arjun Nair (VP Sales NA); must not contradict the Discount Approval Policy. | "Who can sign a contract worth more than ₹5 crore?" / "How long does Legal take to review an NDA?" |
| N6 | Accounts Payable and Vendor Payment Policy | Finance | PDF | Invoice approval levels, payment terms (e.g. 45 days), GST/TDS checks, expense claim deadlines, vendor onboarding. | Travel daily allowances (metro ₹3,500, non-metro ₹2,500, international USD 75) only by reference; FY April–March; CFO Rohan Bhatia. | "What are Nimbus's standard vendor payment terms?" / "By when must an expense claim be submitted?" |
| N7 | Q1 FY2026-27 Revenue and Collections Report | Finance | PDF | Q1 (Apr–Jun 2026) revenue by region and service line, debtor days, top overdue clients, forecast vs the FY27 target. | FY27 revenue target ₹1,340 crore; FY26 revenue ₹1,180 crore; region split ~62% NA / 23% India / 15% ME & Europe; key clients Harbor, Zenith, Al Noor, Crestline. | "What were Nimbus's Q1 FY27 debtor days?" / "Which region brought the most revenue in Q1 FY27?" |
| N8 | Vulnerability Management Standard | IT Security | PDF | Scanning frequency, CVSS-based fix deadlines (e.g. critical in 7 days), exceptions process, reporting to the CISO. | CISO Sameer Khan; ISO 27001:2022, SOC 2 Type II (NimbusOps); must fit the Secure SDLC Standard and Incident Reporting Procedure. | "How fast must a critical vulnerability be fixed?" / "Who approves a vulnerability exception?" |
| N9 | Privileged Access and Quarterly Access Review Procedure | IT Security | DOCX | Who gets admin/prod access, break-glass accounts, quarterly access reviews, removal within 24 h of exit. | Password policy 14+ chars, MFA mandatory, rotation only on compromise; notice period 60/90 days; 24x7 SOC. | "How often are production access rights reviewed?" / "How soon is access removed when someone leaves?" |
| N10 | Design Doc – NimbusOps Multi-Region Active-Passive DR | Engineering | MD | Design doc: current DR, proposed changes, failover steps, risks, decision log. | SLO 99.9%, RPO 15 min, RTO 1 h, Mumbai ap-south-1 primary, Hyderabad ap-south-2 DR, Postgres 16 + Kafka + EKS. | "What RPO does the new DR design target?" / "Which AWS region is the DR site for NimbusOps?" |

After these: Product 2, Finance 2, Legal 2, IT Security 2, Engineering 23, Public 2.
Still thin: Public has no careers page (the welcome page covers offices). Optional 11th doc:
"Careers at Nimbus – Hiring Process FAQ" (HR, MD, Public).

### 1.4 Demo users

| Name | Job title | Role | Departments | Login | From old app? |
|---|---|---|---|---|---|
| Vikram Kulkarni | Founder & CEO | Admin | All | owner@nimbus.example | Yes (was "owner") |
| Neha Gupta | Engineering Manager, NimbusOps | Manager | Engineering (+ Managers) | manager@nimbus.example | Yes |
| Ritika Menon | Manager, HR Operations | Manager | HR (+ Managers) | hr@nimbus.example | Yes |
| Arjun Nair | VP Sales, North America | Manager | Sales | sales@nimbus.example | New (person is in the bible) |
| Aditya Sharma | Software Engineer | Member | Engineering | employee@nimbus.example | Yes |
| Ishaan Verma | Product Analyst, NimbusOps | Member | Product | product@nimbus.example | New |
| Riya Saxena | Design Intern | Guest | Everyone only | guest@nimbus.example | New |
| Ops Agent | MCP service account (not a person) | Member | Engineering | ops-agent@nimbus.example | Yes (keep only if MCP comes back) |

Dropped: `admin@nimbus.example` "IT Admin" (generic, no evals use it).

### 1.5 Suggested questions

| User | Question 1 | Question 2 | Question 3 |
|---|---|---|---|
| Vikram (Admin) | How much did the Board top up the ESOP pool on 14 May 2026? (1.5%) | What is the FY27 revenue target? (₹1,340 crore) | What does the Hyderabad campus expansion cost? (₹45 crore) |
| Neha (Manager) | When is the Harbor Logistics renewal due? (30 Sept 2026) | What is the NimbusOps monthly availability SLO? (99.9%) | How long does a formal PIP last? (Managers dept) |
| Ritika (Manager) | How many days of earned leave can be carried forward? (30) | What is the notice period for a Senior Manager? (90 days) | What is the salary band for an L4 Tech Lead? (₹18–28 lakh) |
| Arjun (Manager) | What is the list price of the NimbusOps Enterprise plan? (USD 5.00 / ₹390 per host per month) | What volume discount applies above 20,000 hosts? (18%) | Who must approve a discount on a proposal? (Discount Approval Policy) |
| Aditya (Member) | Who gets paged for a SEV1 and how fast must we respond? (CISO + CTO, 15 min) | What are the RPO and RTO for NimbusOps? (15 min / 1 h) | What are the password and MFA rules? (14+ chars, MFA mandatory) |
| Ishaan (Member) | Which plans get AI alert summaries? (N2) | Where is NimbusOps customer data stored? (N3) | How many office days a week does hybrid work need? (3) |
| Riya (Guest) | How many office days a week does hybrid work need? (3) | What is the daily allowance for a metro city trip? (₹3,500) | How many days of earned leave do I get a year? (18) |

### 1.6 Permission demo pairs

| Question | Gets the answer | Gets "not found" |
|---|---|---|
| What is the salary band for an L4 Tech Lead? | Ritika (HR): ₹18–28 lakh per annum | Aditya (Engineering) |
| What is the list price of the NimbusOps Enterprise plan? | Arjun (Sales): USD 5.00 per host per month | Aditya, and the website chat (the public FAQ has no prices) |

### 1.7 Evals affected

- PIP Guide and Hiring Approval Workflow evals (asked as Neha): work only if the "Managers"
  department is added; otherwise re-point to Ritika.
- Al Noor and Harbor Account Overview evals (asked as ops-agent): work if Ops Agent is an
  Engineering member; otherwise re-point to Neha.
- All Nimbus `denied_as` tests still hold.

---

## 2. Sanjeevani Pharma

### 2.1 Departments

| Department | What lives here |
|---|---|
| HR | Pay grades, hiring (all new) |
| R&D | R&D reports and clinical trials (old "R&D" + "Clinical" groups) |
| Quality & Manufacturing | Quality SOPs, audits, CAPA, plant projects |
| Regulatory | Filings, licences, data integrity, pharmacovigilance |
| Finance | Budget, credit policy (all new) |
| Sales | Field force rules, targets, brand plans, distributor terms |
| Leadership | Board minutes, annual results, expansion and in-licensing papers |
| *Everyone* | Handbook, HR policies (leave, shifts, insurance, training), product information |
| *Public* | About Sanjeevani, product monographs and sheets, plus new FAQs |

### 2.2 Existing documents (57)

| # | Title | Type | Old collection | New department | Public? |
|---|---|---|---|---|---|
| 1 | About Sanjeevani | MD | Company Handbook | Everyone | **Yes** |
| 2 | Code of Business Conduct | PDF | Company Handbook | Everyone | No |
| 3 | Plant Safety and EHS Policy | PDF | Company Handbook | Everyone | No |
| 4 | Travel Policy | DOCX | Company Handbook | Everyone | No |
| 5 | Whistleblower Policy | PDF | Company Handbook | Everyone | No (classified "Public" in old corpus; owner may flip) |
| 6 | Leave Policy 2026 | PDF | HR Policies | Everyone | No |
| 7 | Shift and Overtime Policy | PDF | HR Policies | Everyone | No |
| 8 | Training and GMP Qualification Policy | DOCX | HR Policies | Everyone | No |
| 9 | Employee Medical Insurance Guide | PDF | HR Policies | Everyone | No |
| 10 | Glucosan-M 500 Product Monograph | PDF | Product Information | Everyone | **Yes** |
| 11 | Cardivas 10 Product Monograph | PDF | Product Information | Everyone | **Yes** |
| 12 | Amlosan 5 Product Monograph | PDF | Product Information | Everyone | **Yes** |
| 13 | Pantosan 40 Product Monograph | PDF | Product Information | Everyone | **Yes** |
| 14 | Sanjeevani Cough Relief Syrup Product Sheet | DOCX | Product Information | Everyone | **Yes** |
| 15 | Dermacalm Cream Product Sheet | DOCX | Product Information | Everyone | **Yes** |
| 16 | Product Portfolio and Storage Conditions | MD | Product Information | Everyone | No |
| 17 | Field Force Guidelines FY27 | PDF | Sales & Marketing | Sales | No |
| 18 | UCPMP Compliance Guide for Field Staff | PDF | Sales & Marketing | Sales | No |
| 19 | Sample Distribution Policy | DOCX | Sales & Marketing | Sales | No |
| 20 | FY27 Sales Targets by Zone | PDF | Sales & Marketing | Sales | No |
| 21 | Glucosan-M Brand Plan FY27 | DOCX | Sales & Marketing | Sales | No |
| 22 | Doctor Engagement and CME Guidelines | PDF | Sales & Marketing | Sales | No |
| 23 | SOP – Batch Manufacturing Record Review | PDF | Quality SOPs | Quality & Manufacturing | No |
| 24 | SOP – Deviation Handling | PDF | Quality SOPs | Quality & Manufacturing | No |
| 25 | SOP – Deviation Handling v2 (2022) (SUPERSEDED by #24) | PDF | Quality SOPs | Quality & Manufacturing | No |
| 26 | SOP – Out of Specification Investigation | PDF | Quality SOPs | Quality & Manufacturing | No |
| 27 | SOP – Cleanroom Gowning | PDF | Quality SOPs | Quality & Manufacturing | No |
| 28 | SOP – Purified Water System Monitoring | PDF | Quality SOPs | Quality & Manufacturing | No |
| 29 | SOP – Change Control | PDF | Quality SOPs | Quality & Manufacturing | No |
| 30 | Specification – Glucosan-M 500 SR Tablets | PDF | Quality SOPs | Quality & Manufacturing | No |
| 31 | SOP – Product Recall Procedure | PDF | Quality SOPs | Quality & Manufacturing | No |
| 32 | US FDA Inspection 2024 – Response and CAPA Summary | PDF | Quality Audits & CAPA | Quality & Manufacturing | No |
| 33 | FDA Re-inspection February 2026 Summary | PDF | Quality Audits & CAPA | Quality & Manufacturing | No |
| 34 | Internal Audit Report – Unit II Baddi Q4 FY26 | DOCX | Quality Audits & CAPA | Quality & Manufacturing | No |
| 35 | Recall Report – Cough Syrup Batch CR-2309 | PDF | Quality Audits & CAPA | Quality & Manufacturing | No |
| 36 | CAPA Register Q1 FY27 | DOCX | Quality Audits & CAPA | Quality & Manufacturing | No |
| 37 | Regulatory Affairs Calendar 2026 | MD | Regulatory Filings | Regulatory | No |
| 38 | ANDA Submission Status Tracker | DOCX | Regulatory Filings | Regulatory | No |
| 39 | CDSCO Product Licence Renewal Summary | PDF | Regulatory Filings | Regulatory | No |
| 40 | Data Integrity Policy – ALCOA+ | PDF | Regulatory Filings | Regulatory | No |
| 41 | Pharmacovigilance System Master File Summary | PDF | Regulatory Filings | Regulatory | No |
| 42 | SJ-2041 Formulation Development Report | PDF | R&D Reports | R&D | No |
| 43 | Stability Study Report – Glucosan-M 500 SR | PDF | R&D Reports | R&D | No |
| 44 | Bioequivalence Study Summary – Cardivas 10 | PDF | R&D Reports | R&D | No |
| 45 | R&D Pipeline Review FY27 | DOCX | R&D Reports | R&D | No |
| 46 | Analytical Method Validation – Pantosan 40 | PDF | R&D Reports | R&D | No |
| 47 | R&D Lab Safety Manual | MD | R&D Reports | R&D | No |
| 48 | SJ-2041 Phase III Protocol Synopsis | PDF | Clinical Trials | R&D | No |
| 49 | SJ-2041 Interim Analysis Report | PDF | Clinical Trials | R&D | No |
| 50 | Clinical Site List and Enrolment Status | DOCX | Clinical Trials | R&D | No |
| 51 | Serious Adverse Event Reporting SOP | PDF | Clinical Trials | R&D | No |
| 52 | Data Safety Monitoring Board Charter | PDF | Clinical Trials | R&D | No |
| 53 | Investigator Payments Policy | DOCX | Clinical Trials | R&D | No |
| 54 | Board Meeting Minutes – 22 April 2026 | PDF | Board & Leadership | Leadership | No |
| 55 | FY2025-26 Annual Results Summary | PDF | Board & Leadership | Leadership | No |
| 56 | Vizag Expansion Investment Note | DOCX | Board & Leadership | Leadership | No |
| 57 | Biosimilar Insulin In-licensing Brief | PDF | Board & Leadership | Leadership | No |

Old collections shared with Leadership (Sales & Marketing, Quality Audits, Regulatory,
Clinical) now sit in one department each; the Admin has all departments, so nothing is lost.

**Counts (existing):**

| Department | Docs | Gap? |
|---|---|---|
| Everyone | 16 | |
| HR | 0 | **GAP** |
| R&D | 12 | |
| Quality & Manufacturing | 14 | (quality-heavy; no manufacturing/plant project docs) |
| Regulatory | 5 | |
| Finance | 0 | **GAP** |
| Sales | 6 | |
| Leadership | 4 | |
| Public (flag) | 7 | (no careers, returns or side-effect reporting info) |
| **Total** | **57** | |

### 2.3 New documents to write (9)

| # | Title | Department | Type | What it says | Must agree with (bible) | Example questions |
|---|---|---|---|---|---|---|
| S1 | Salary Grades and Allowances FY2026-27 | HR | PDF | Grade structure (plant, field, R&D, corporate), pay ranges, field and plant allowances, increment budget. **Only place with pay ranges.** | 2,850 employees; ~180 medical reps; night-shift allowance ₹2,800/month (same as Shift and Overtime Policy). | "What is the pay range for a Grade M2 medical representative?" / "What is the FY27 average increment budget?" |
| S2 | Careers at Sanjeevani – Hiring and Campus Programme FAQ | HR | MD | Where we hire (Ahmedabad, Baddi, Vizag, Hyderabad R&D, field), how to apply, campus trainee programme, no fees ever charged. | Sites: Unit I Changodar, Unit II Baddi, Unit III Vizag SEZ, R&D Genome Valley; registered office Ahmedabad. | "Does Sanjeevani hire freshers at the Vizag plant?" / "Does Sanjeevani charge a fee for job applications?" — **Public: yes** |
| S3 | FY2026-27 Budget and Capex Plan | Finance | PDF | Revenue, cost and capex budget by unit; R&D spend; capex phasing for Vizag. | FY26 revenue ₹2,460 crore (58% domestic / 42% export); FY27 domestic target ₹1,520 crore; R&D 6.8% of revenue; Vizag expansion ₹310 crore. | "What is the FY27 capex for Vizag this year?" / "What is the FY27 R&D budget?" |
| S4 | Stockist Credit and Collections Policy | Finance | PDF | Credit limits and days for stockists/distributors, interest on overdue, when supplies are stopped, bad-debt write-off approvals. | CFO Suresh Mehta; National Sales Manager Nikhil Shah; zones West/South/North/East. | "How many credit days does a stockist get?" / "When are supplies stopped for overdue payments?" |
| S5 | Stockist and Distributor Agreement – Standard Terms | Sales | DOCX | Contract summary: territory, margins, minimum orders, cold-chain/storage duties, expiry returns, termination. | Product storage: Glucosan-M below 30°C, shelf life 36/24/30 months; UCPMP 2024 code. | "What margin does a stockist get on Glucosan-M 500?" / "How much notice ends a stockist agreement?" |
| S6 | Product Returns and Expiry Replacement Policy | Sales | PDF | What can be returned, near-expiry replacement window, damaged goods, recall returns. | Shelf lives (Glucosan-M 36 m, cough syrup 24 m, Dermacalm 30 m); recall of batch CR-2309 (Aug 2025, 18,400 bottles, label misprint). | "Can a pharmacy return near-expiry Dermacalm?" / "How are recalled products refunded?" — **Public: yes** |
| S7 | Project Plan – Vizag Unit III Capacity Expansion | Quality & Manufacturing | DOCX | Phases, milestones, qualification (IQ/OQ/PQ), owners, risks, budget tracking. | ₹310 crore approved 22 April 2026; Unit III is the US FDA-inspected export unit (Feb 2026: no observations); plant head Venkat Raju. | "When does the new Vizag line start commercial batches?" / "Who owns qualification of the new Vizag line?" |
| S8 | Clinical Research Services Agreement – SJ-2041 (CRO) | R&D | PDF | Contract with a fictional CRO: scope, sites, payment milestones, data ownership, confidentiality. | SJ-2041 Phase III: protocol SPL/CLN/PRT-017, CTRI/2025/03/061842, 1,240 patients, 38 sites, 24 weeks, topline Jan 2027; lead Dr. Ananya Krishnan. Must not contradict Investigator Payments Policy. | "Which payment milestone is tied to database lock?" / "Who owns the trial data under the CRO contract?" |
| S9 | Medicine Information and Side-Effect Reporting FAQ | Regulatory | MD | For patients and doctors: how to report a side effect, medical information contact, storage tips, recall notices. | Pharmacovigilance system (PSMF summary); product storage and shelf lives; Head of Regulatory Pooja Desai. | "How do I report a side effect of Cardivas 10?" / "How should Glucosan-M be stored at home?" — **Public: yes** |

After these: HR 2, Finance 2, Sales 8, Quality & Manufacturing 15, R&D 13, Regulatory 6, Public 10.

### 2.4 Demo users

| Name | Job title | Role | Departments | Login | From old app? |
|---|---|---|---|---|---|
| Dr. Harish Patel | Managing Director & CEO | Admin | All | owner@sanjeevani.example | Yes (was "owner") |
| Dr. Farhan Qureshi | Head, Quality Assurance | Manager | Quality & Manufacturing, Regulatory | qa@sanjeevani.example | Yes |
| Nikhil Shah | National Sales Manager | Manager | Sales | salesmanager@sanjeevani.example | New (person is in the bible) |
| Priya Bhatt | Head, Human Resources | Manager | HR | hr@sanjeevani.example | New (person is in the bible) |
| Karan Malhotra | Medical Representative, Mumbai | Member | Sales | sales@sanjeevani.example | Yes |
| Dr. Sneha Rao | Research Scientist | Member | R&D | rnd@sanjeevani.example | Yes (old R&D + Clinical) |
| Aman Trivedi | QC Trainee (contract) | Guest | Everyone only | guest@sanjeevani.example | New |

Dropped: `admin@sanjeevani.example` "IT Admin".

### 2.5 Suggested questions

| User | Question 1 | Question 2 | Question 3 |
|---|---|---|---|
| Dr. Harish Patel (Admin) | What dividend did the Board recommend for FY2025-26? (₹4.50/share) | How much was approved for the Vizag expansion? (₹310 crore) | What is the code name of the biosimilar insulin we are in-licensing? (BIO-INS-7) |
| Dr. Farhan Qureshi (Manager) | How fast must a critical deviation reach the QA head? (24 h) | What did the 2024 US FDA Form 483 observe at Vizag? (3 observations) | What is the Grade D particle limit at rest? (3,520,000 ≥0.5 µm per m³) |
| Nikhil Shah (Manager) | What is the FY27 sales target for the West zone? (₹425.6 crore) | How many doctor visits must a rep make each month? (180) | How many Glucosan-M sample strips may a doctor get per month? (10) |
| Priya Bhatt (Manager) | What is the night-shift allowance at the plants? (₹2,800/month) | How many days of privilege leave do we get? (21) | What is the pay range for a medical representative? (S1) |
| Karan Malhotra (Member) | How should Glucosan-M 500 be stored and what is its shelf life? (below 30°C, 36 months) | Can I give a doctor a gift under the UCPMP code? (No) | How many Glucosan-M sample strips may a doctor get per month? (10) |
| Dr. Sneha Rao (Member) | What HbA1c reduction did SJ-2041 show at the interim analysis? (−1.1% vs −0.6%) | How many patients and sites are in the SJ-2041 Phase III trial? (1,240 / 38) | When is the SJ-2041 topline readout expected? (Jan 2027) |
| Aman Trivedi (Guest) | How many days of sick leave do I get? (7) | What is the shelf life of Dermacalm Cream? (30 months) | Is PPE mandatory on the plant floor? (Yes) |

### 2.6 Permission demo pairs

| Question | Gets the answer | Gets "not found" |
|---|---|---|
| What is the FY27 sales target for the West zone? | Karan or Nikhil (Sales): ₹425.6 crore | Dr. Sneha Rao (R&D) |
| What HbA1c reduction did SJ-2041 show at the Phase III interim analysis? | Dr. Sneha Rao (R&D): −1.1% vs −0.6% comparator | Karan Malhotra (Sales) |

### 2.7 Evals affected

None. Every Sanjeevani eval user keeps access, and every `denied_as` test still holds
(Clinical folds into R&D; Dr. Farhan is not in R&D; Karan is not in Leadership).

---

## 3. Kaveri Capital (asset management)

### 3.1 Departments

| Department | What lives here |
|---|---|
| HR | Pay bands, hiring (all new) |
| Investments | Market research and Investment Committee papers |
| Compliance & Legal | KYC/AML, insider trading, complaints, risk reports, distributor agreements |
| Finance | Financial statements, budget, audit letter, TER, treasury |
| Client Services | Client agreements, fee schedules, onboarding, investor FAQ |
| Operations | Settlement, fund accounting, business continuity, launch plans (all new) |
| Leadership | Board minutes, board risk committee, GIFT City proposal, succession |
| *Everyone* | Handbook, HR policies, fund factsheets, NAV cut-offs |
| *Public* | About Kaveri, factsheets, NAV cut-offs, new investor and careers FAQs |

### 3.2 Existing documents (56)

| # | Title | Type | Old collection | New department | Public? |
|---|---|---|---|---|---|
| 1 | About Kaveri Capital | MD | Company Handbook | Everyone | **Yes** |
| 2 | Code of Conduct and Ethics | PDF | Company Handbook | Everyone | No |
| 3 | Personal Trading Policy | PDF | Company Handbook | Everyone | No |
| 4 | Information Security and Device Policy | DOCX | Company Handbook | Everyone | No |
| 5 | Travel and Entertainment Policy | PDF | Company Handbook | Everyone | No |
| 6 | NAV Computation and Cut-off Timings | MD | Company Handbook | Everyone | **Yes** *(new flag: cut-off times are investor information)* |
| 7 | Leave Policy 2026 | PDF | HR Policies | Everyone | No |
| 8 | Mandatory Block Leave Policy | PDF | HR Policies | Everyone | No |
| 9 | Performance and Bonus Framework | DOCX | HR Policies | Everyone | No |
| 10 | Learning and Certification Policy – NISM | PDF | HR Policies | Everyone | No |
| 11 | Kaveri Bluechip Fund Factsheet March 2026 | PDF | Fund Factsheets | Everyone | **Yes** |
| 12 | Kaveri Flexi Cap Fund Factsheet March 2026 | PDF | Fund Factsheets | Everyone | **Yes** |
| 13 | Kaveri Small Cap Opportunities Factsheet March 2026 | PDF | Fund Factsheets | Everyone | **Yes** |
| 14 | Kaveri Short Duration Fund Factsheet March 2026 | PDF | Fund Factsheets | Everyone | **Yes** |
| 15 | Kaveri Arbitrage Fund Factsheet March 2026 | PDF | Fund Factsheets | Everyone | **Yes** |
| 16 | Kaveri Focused Equity PMS Presentation Summary | DOCX | Fund Factsheets | Everyone | **Yes** |
| 17 | Product Guide – Which Kaveri Fund Fits Which Investor | MD | Fund Factsheets | Everyone | No (reads like advice; owner may flip) |
| 18 | India Strategy Outlook FY27 | PDF | Market Research | Investments | No |
| 19 | Banking Sector Deep Dive – Q4 FY26 | PDF | Market Research | Investments | No |
| 20 | Capital Goods and Railways Capex Theme | PDF | Market Research | Investments | No |
| 21 | IT Services Sector Note – Underweight Call | PDF | Market Research | Investments | No |
| 22 | FMCG Sector Note | DOCX | Market Research | Investments | No |
| 23 | Monthly Macro Dashboard April 2026 | MD | Market Research | Investments | No |
| 24 | Initiating Coverage – Konkan Rail Systems Ltd | PDF | Market Research | Investments | No |
| 25 | Earnings Season Review Q4 FY26 | DOCX | Market Research | Investments | No |
| 26 | IC Meeting 47 Minutes – 12 March 2026 | PDF | Investment Committee | Investments | No |
| 27 | IC Meeting 48 Minutes – 9 April 2026 | PDF | Investment Committee | Investments | No |
| 28 | Investment Process and IC Charter | PDF | Investment Committee | Investments | No |
| 29 | Restricted List Procedure | DOCX | Investment Committee | Investments | No |
| 30 | Vindhyagiri Cementworks Exit Note | PDF | Investment Committee | Investments | No |
| 31 | KYC and Customer Due Diligence Policy | PDF | Compliance & KYC | Compliance & Legal | No |
| 32 | KYC Policy 2022 (SUPERSEDED by #31) | PDF | Compliance & KYC | Compliance & Legal | No |
| 33 | Anti-Money Laundering Policy | PDF | Compliance & KYC | Compliance & Legal | No |
| 34 | Suspicious Transaction Reporting SOP | PDF | Compliance & KYC | Compliance & Legal | No |
| 35 | Politically Exposed Persons Procedure | DOCX | Compliance & KYC | Compliance & Legal | No |
| 36 | Insider Trading Prevention Code – SEBI PIT | PDF | Compliance & KYC | Compliance & Legal | No |
| 37 | Complaint Handling and SCORES Procedure | PDF | Compliance & KYC | Compliance & Legal | No |
| 38 | Compliance Monitoring Calendar FY27 | MD | Compliance & KYC | Compliance & Legal | No |
| 39 | Investment Risk Limits Policy | PDF | Risk Reports | Compliance & Legal | No |
| 40 | Q4 FY26 Risk Dashboard | PDF | Risk Reports | Compliance & Legal | No |
| 41 | Small Cap Liquidity Breach Remediation Plan | DOCX | Risk Reports | Compliance & Legal | No |
| 42 | Stress Test Results March 2026 | PDF | Risk Reports | Compliance & Legal | No |
| 43 | Operational Risk Incident Log FY26 | DOCX | Risk Reports | Compliance & Legal | No |
| 44 | PMS Client Agreement – Standard Terms | PDF | Client Agreements | Client Services | No |
| 45 | Fee Schedule and Exit Loads | PDF | Client Agreements | Client Services | No |
| 46 | Discretionary vs Non-Discretionary PMS Explainer | DOCX | Client Agreements | Client Services | No |
| 47 | Institutional Mandate Term Sheet Template | DOCX | Client Agreements | Client Services | No |
| 48 | FY2025-26 Financial Statements Summary | PDF | Finance & Accounts | Finance | No |
| 49 | FY2026-27 Budget | PDF | Finance & Accounts | Finance | No |
| 50 | Expense Ratio and TER Computation Note | DOCX | Finance & Accounts | Finance | No |
| 51 | Statutory Audit Management Letter FY26 | PDF | Finance & Accounts | Finance | No |
| 52 | Treasury and Investment of Own Funds Policy | PDF | Finance & Accounts | Finance | No |
| 53 | Board Meeting Minutes – 25 April 2026 | PDF | Board Materials | Leadership | No |
| 54 | Board Risk Committee Report Q4 FY26 | PDF | Board Materials | Leadership | No |
| 55 | GIFT City Feeder Fund Proposal | DOCX | Board Materials | Leadership | No |
| 56 | Succession Planning Note | PDF | Board Materials | Leadership | No |

Risk reports go to Compliance & Legal (the old Compliance group read them; the risk team
reports to the CRO, who sits with compliance). Client agreements go to Client Services
(old access was Compliance + Finance).

**Counts (existing):**

| Department | Docs | Gap? |
|---|---|---|
| Everyone | 17 | |
| HR | 0 | **GAP** |
| Investments | 13 | |
| Compliance & Legal | 13 | |
| Finance | 5 | |
| Client Services | 4 | |
| Operations | 0 | **GAP** |
| Leadership | 4 | |
| Public (flag) | 8 | (no investor service FAQ, no careers info) |
| **Total** | **56** | |

### 3.3 New documents to write (9)

| # | Title | Department | Type | What it says | Must agree with (bible) | Example questions |
|---|---|---|---|---|---|---|
| K1 | Compensation Bands and Bonus Pool FY2026-27 | HR | PDF | Pay bands by grade (analyst to fund manager), bonus pool size and deferral rules for fund managers. **Only place with pay.** | 310 employees (34 analysts); FY27 employee cost budget ₹96 crore; Performance and Bonus Framework rules; Head of HR Deepa Nambiar. | "What is the pay band for a senior research analyst?" / "How much of a fund manager's bonus is deferred?" |
| K2 | Careers at Kaveri – Roles, Hiring and Internships | HR | MD | Teams that hire, offices, hiring steps, NISM certification needed for some roles, summer internship. | Offices: Bengaluru HQ (MG Road), Mumbai BKC, New Delhi CP, Chennai, Pune; NISM policy. | "Does Kaveri offer summer internships?" / "Which certification do I need to join as a dealer?" — **Public: yes** |
| K3 | Trade Settlement and Fund Accounting SOP | Operations | PDF | Daily trade flow, settlement checks, NAV sign-off steps, breaks and escalation, registrar reconciliation. | NAV cut-off 3:00 pm; NAV Computation document; Head of Operations Mohit Arora. | "By what time must the day's trades be reconciled?" / "Who signs off the daily NAV?" |
| K4 | Business Continuity and Disaster Recovery Plan | Operations | DOCX | Critical processes, recovery time targets, backup office (e.g. Mumbai BKC for Bengaluru HQ), call tree, test schedule. | Offices list; FY27 tech spend ₹14 crore; CRO Varun Pillai. | "Which office takes over if Bengaluru HQ is down?" / "How often is the BCP tested?" |
| K5 | Project Plan – GIFT City Feeder Fund Launch | Operations | DOCX | Workstreams (regulatory, custody, systems, distribution), milestones, owners, risks. | Board 25 April 2026 approved it; **target launch Jan 2027**; must match GIFT City Feeder Fund Proposal. | "When is the GIFT City feeder fund due to launch?" / "Who owns the custody workstream?" |
| K6 | PMS and AIF Client Onboarding Checklist | Client Services | DOCX | Step-by-step onboarding: KYC, minimums, agreement, fee choice, first funding, portal access. | PMS minimum ₹50 lakh; AIF minimum ₹1 crore; CKYC + PAN; PEP needs CCO approval; no cash; PMS fee options. | "What is the minimum to open a PMS account?" / "Who must approve a PEP client?" |
| K7 | Investor Service FAQ – Redemptions, Exit Loads and Statements | Client Services | MD | Website FAQ: cut-off times, exit loads, redemption payout time, statements, how to complain (SCORES). | Cut-off 3:00 pm; equity exit load 1% within 365 days; PMS exit load 3% / 2% / 1%; no cash accepted. | "Is there an exit load if I redeem the Flexi Cap fund after 8 months?" / "How do I raise a complaint?" — **Public: yes** |
| K8 | Sales Sheet – Kaveri Focused Equity PMS (for Relationship Managers) | Client Services | PDF | One-page pitch for RMs: strategy, fee options, minimum, talking points, what not to promise. | PMS AUM ₹1,350 crore, manager Ashok Venkataraman, benchmark Nifty 500 TRI; fee 2.0% fixed OR 1.0% + 20% over 10% hurdle (high-water mark). | "What fee options can I offer a PMS client?" / "What must an RM never promise a client?" |
| K9 | Distributor (MFD) Empanelment Agreement – Standard Terms | Compliance & Legal | PDF | Contract terms for mutual fund distributors: commission rules, KYC duties, conduct, termination. | KYC rules (CKYC, re-KYC 2/8 years), AML/STR within 7 days, Code of Conduct; CCO Shalini Kapoor. | "Can a distributor accept cash from an investor?" / "On what grounds can Kaveri end a distributor agreement?" |

After these: HR 2, Operations 3, Client Services 7, Compliance & Legal 14, Public 10.

### 3.4 Demo users

| Name | Job title | Role | Departments | Login | From old app? |
|---|---|---|---|---|---|
| Ramesh Iyengar | Managing Director & CEO | Admin | All | owner@kaveri.example | Yes (was "owner") |
| Shalini Kapoor | Chief Compliance Officer | Manager | Compliance & Legal | compliance@kaveri.example | Yes |
| Gaurav Agarwal | Chief Financial Officer | Manager | Finance, Leadership | cfo@kaveri.example | Yes |
| Mohit Arora | Head of Operations | Manager | Operations | ops@kaveri.example | New (person is in the bible) |
| Tanvi Joshi | Equity Research Analyst | Member | Investments | analyst@kaveri.example | Yes (old "Research") |
| Nandini Rao | Relationship Manager, PMS | Member | Client Services | rm@kaveri.example | New |
| Kabir Sethi | Summer Intern, Research | Guest | Everyone only | guest@kaveri.example | New |

Dropped: `admin@kaveri.example` "IT Admin".

### 3.5 Suggested questions

| User | Question 1 | Question 2 | Question 3 |
|---|---|---|---|
| Ramesh (Admin) | When is the GIFT City feeder fund due to launch? (Jan 2027) | How much interim dividend did the Board approve? (₹12 crore) | Who was appointed independent director? (Justice (retd.) S. Venugopal) |
| Shalini (Manager) | How often must a high-risk client be re-KYC'd? (every 2 years) | How soon must an STR go to FIU-IND? (within 7 days) | What was the Small Cap liquidity in Q4 FY26? (11.8%, breach of 15% floor) |
| Gaurav (Manager) | What were FY26 revenue and PAT? (₹212 / ₹58 crore) | What is the FY27 technology budget? (₹14 crore) | Which firm audits us, and what was the opinion? (Raghavan & Mehta LLP, clean) |
| Mohit (Manager) | What is the NAV cut-off time? (3:00 pm) | Which office takes over if Bengaluru HQ is down? (K4) | When is the GIFT City feeder fund launching? (K5, Jan 2027) |
| Tanvi (Member) | What is the house-view Nifty 50 year-end target? (26,800) | What did IC 48 decide about Vindhyagiri Cementworks? (exit from Small Cap) | How many stocks does Research cover? (142) |
| Nandini (Member) | What fee options does the PMS offer? (2.0% fixed, or 1.0% + 20% over 10% hurdle) | What is the PMS exit load? (3% / 2% / 1% in years 1–3) | What is the minimum PMS investment? (₹50 lakh) |
| Kabir (Guest) | What was the Bluechip Fund's 1-year return? (14.2%) | How long must I hold a stock under the personal trading policy? (30 days) | Who must take 10 days of block leave? (dealers and fund managers) |

### 3.6 Permission demo pairs

| Question | Gets the answer | Gets "not found" |
|---|---|---|
| What is the house-view Nifty 50 year-end target? | Tanvi (Investments): 26,800 | Shalini (Compliance & Legal) |
| What was the Small Cap fund's liquidity in the Q4 FY26 risk report? | Shalini (Compliance & Legal): 11.8%, a breach of the 15% floor | Tanvi (Investments) |

### 3.7 Evals affected

- "What rating and target price did Research give Konkan Rail Systems?" was asked as Gaurav
  (old Leadership could read research). Re-point to Tanvi or Ramesh; `denied_as`
  Shalini still holds.
- The "Fee Schedule and Exit Loads" eval was asked as Gaurav. Re-point to Nandini (Client
  Services).
- All other `denied_as` tests still hold.

---

## 4. Totals

| | Nimbus | Sanjeevani | Kaveri | Total |
|---|---|---|---|---|
| Existing documents | 58 | 57 | 56 | **171** |
| New documents | 10 | 9 | 9 | **28** |
| Documents after | 68 | 66 | 65 | **199** |
| Public after (existing + new) | 2 | 10 | 10 | 22 |
| Demo users (people) | 7 (+1 MCP service account) | 7 | 7 | **21** (+1) |

## 5. Things in the old corpus to know about

- The eval file has **125** questions; PLAN.md says 122.
- The bibles say 29 + 29 documents per company, but Sanjeevani has 57 (writer B wrote 28) and
  Kaveri 56 (writer B wrote 26, plus "NAV Computation" added to the handbook). Total 171 matches.
- Old access groups do not match v2 departments: "Delivery", "Managers", "Clinical",
  "Research", "Quality" are groups, and several collections were shared by two groups
  (e.g. Kaveri Risk Reports = Compliance + Leadership). v2 puts each document in one department.
- Nimbus leave, notice and referral policies were HR-only (and marked Confidential), unlike
  the other two companies. Moved to Everyone above.
- The three "About/Welcome" documents are marked `public: yes` but classified "Internal".
- Sanjeevani's Whistleblower Policy is classified "Public" but not flagged public.
- Each company had a generic "IT Admin" login and Nimbus has an "Ops Agent" MCP account;
  neither is a real person.
- Exactly one superseded document per company (Nimbus Leave Policy FY2024-25, Sanjeevani
  SOP – Deviation Handling v2 (2022), Kaveri KYC Policy 2022). v2 should keep them and demote
  them in search, like the old loader.
- A stale copy of the corpus and evals sits in the old repo under `.claude/worktrees/`; use
  the top-level `demo_corpus/` and `evals/` only.
