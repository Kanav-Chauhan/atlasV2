# Demo corpus spec (shared by every writer, the renderer and the seed)

Three **fictional** Indian companies, one Atlas org (tenant) each. Northwind is retired.
Contoso stays only as the hidden tenant-isolation test org.

| Org slug | Company | Industry | Bible |
|---|---|---|---|
| `nimbus` | Nimbus Infotech Pvt. Ltd. | IT services | `bibles/nimbus.md` |
| `sanjeevani` | Sanjeevani Pharma Ltd. | Pharmaceuticals | `bibles/sanjeevani.md` |
| `kaveri` | Kaveri Capital Advisors Pvt. Ltd. | Asset management / finance | `bibles/kaveri.md` |

## Folder layout

```
demo_corpus/
  SPEC.md                    this file
  bibles/<slug>.md           the company "bible": facts every document must agree with
  source/<slug>/<file>.md    one Markdown source per document (front matter + body)
  build/<slug>/<file>.pdf|docx|md   rendered output (generated, never hand-edited)
  eval_candidates/<slug>-<a|b>.json  eval questions proposed by each writer
```

## Source file format

File name: `snake_case` of the title, e.g. `leave_and_holiday_policy.md`. Front matter is
simple `key: value` lines (no quotes, no YAML lists):

```
---
title: Leave and Holiday Policy
collection: HR Policies
format: pdf
doc_no: NIM/HR/POL-004
version: 3.1
effective: 01 April 2026
review: 31 March 2027
classification: Internal
department: People Operations
prepared_by: Ritika Menon, Manager – HR Operations
approved_by: Anjali Deshpande, Chief People Officer
stamp: APPROVED
---
# Leave and Holiday Policy

## 1. Purpose
...
```

- `format`: `pdf` (~60%), `docx` (~25%), `md` (~15%: runbooks, READMEs, wiki-style notes).
- `classification`: `Public`, `Internal`, `Confidential` or `Restricted`.
- `superseded_by` (only with stamp SUPERSEDED): the exact title of the document that replaced this one; the loader links them so search demotes the old one.
- `public: yes` (optional): the loader marks the document public, so the company's website chat may answer from it. Only company-overview, product and fund documents; never HR, salary or board documents.
- `stamp`: one of `APPROVED`, `CONTROLLED COPY`, `QA RELEASED`, `BOARD APPROVED`, `DRAFT`,
  `SUPERSEDED`, `CONFIDENTIAL`, `none`. Use the ones that fit the company (bible says which).
- `doc_no` follows the company's numbering scheme in its bible. Must be unique.
- `collection` must be one of the company's collections in its bible, spelled exactly.
- Do **not** repeat the front-matter metadata in the body: the renderer prints the
  letterhead, document-control box, header/footer, signature block and stamp from it.
- Body: Markdown. `#` title once, numbered `##` sections, `###` subsections, bullet lists,
  and pipe tables (`| a | b |`) where real documents would have them (finance and QA docs
  especially). 600–1,500 words. No images, no HTML.

## Writing rules

- Every name, number, date, product, office and person must agree with the bible. You may
  invent new *minor* facts (a ticket number, a vendor, a meeting date) but never contradict
  the bible, and keep them plausible and internally consistent.
- Make each document contain **specific, answerable facts**: numbers, thresholds, dates,
  owners, steps, limits, table values. Vague prose makes a useless demo.
- Realistic tone for the document type (SOP ≠ board minutes ≠ runbook ≠ factsheet).
  Indian context: ₹ (lakh/crore where natural), Indian cities, FY = April–March,
  Indian regulators referenced by name in text only (SEBI, RBI, CDSCO, MeitY, etc.).
- **Fictional only.** No real companies as the subject, no real people, no real logos or
  seals. Real regulators/laws may be *mentioned* (e.g. "Schedule M", "DPDP Act 2023").
- Some facts should exist in exactly one restricted collection (e.g. salary bands only in
  HR's "Compensation"), so the same question gives different answers to different roles.

## Eval candidates (each writer)

Write `eval_candidates/<slug>-<a|b>.json`: a JSON list of ~15 objects, one per question:

```json
{"q": "How many days of earned leave do Nimbus employees get per year?",
 "doc": "Leave and Holiday Policy",
 "evidence": "18 days of earned leave",
 "answer": "18 days of earned leave per financial year.",
 "as": "employee@nimbus.example",
 "tags": ["fact"]}
```

- `evidence` is a verbatim substring of the document body (exact text, used for scoring).
- `as` is a demo user from the bible who CAN read that document.
- Tags: `fact` (most), `table` (answer comes from a table), `multi_hop` (needs two sections),
  and 2–3 per writer tagged `restricted`: same shape, but also add
  `"denied_as": "<a demo user who cannot read it>"`, so we check the answer is withheld.
- Also 1–2 tagged `not_found`: a plausible question the documents do NOT answer
  (`doc`, `evidence` = null, `answer` = "not found").

## Atlas v2 changes

- `collection:` is replaced by `access:` = one department from `demo_corpus/orgs/<slug>.json`, or `Everyone`.
- A document with `public: yes` always has `access: Everyone` (anything on the company website is readable by all staff).
- Build/check: `uv run --with pymupdf --with python-docx python tools/corpus/build.py [--org <slug>] [--only-missing] [--check]`.
- Eval set: `evals/demo_v2.json` (merged from `evals/candidates/<slug>.json`).
