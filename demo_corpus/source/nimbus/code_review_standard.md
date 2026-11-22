---
title: Code Review Standard
access: Engineering
format: docx
doc_no: NIM/ENG/STD-003
version: 1.5
effective: 01 April 2026
review: 31 March 2027
classification: Internal
department: Engineering – Architecture Office
prepared_by: Siddharth Rao, Principal Architect
approved_by: Meera Iyer, Chief Technology Officer
stamp: APPROVED
---
# Code Review Standard

## 1. Purpose

Code review at Nimbus Infotech exists to catch defects early, spread knowledge across the team and keep the codebase consistent. This standard applies to all repositories in the `nimbus-eng` GitHub organisation, including NimbusOps and internal tools, and to client repositories unless the client's own process is stricter.

## 2. Pull request requirements

| Rule | Requirement |
|---|---|
| Size | Should be **≤ 400 changed lines** (excluding generated files and lock files). PRs above 800 lines need a justification in the description. |
| Description | What and why, linked ticket (`NOPS-1234`), testing done, rollout/rollback notes |
| CI | All checks green before review is requested: build, unit tests, lint, SAST, dependency scan, secrets scan |
| Tests | New or changed logic has tests; **line coverage on new code ≥ 80%** (SonarQube quality gate) |
| Commits | Squash-merge into `main`; commit title follows Conventional Commits (`fix:`, `feat:`, `chore:`) |
| Draft PRs | Use draft status until ready; reviewers are not expected to look at drafts |

## 3. Approvals

| Change type | Approvals required | Who |
|---|---|---|
| Standard change | 1 | Any engineer L3 or above on the owning team |
| Critical paths (authentication, authorisation, billing, tenant isolation, cryptography) | 2 | One must be a CODEOWNER; one from Security Champions for auth/crypto |
| Database migrations | 2 | One must be from the DBA reviewers group |
| Infrastructure as code (Terraform, Helm values for prod) | 2 | One from SRE |
| Public API changes | 2 | One from the Architecture Office |
| Dependency-only bumps (Renovate, patch level) | 1 | Auto-merge allowed for patch updates with green CI |

Authors cannot approve their own PRs. Branch protection on `main` enforces approvals, required checks and dismissal of stale approvals on new commits.

## 4. Turnaround expectations

- First review response within **1 business day** of the review request.
- Hotfix PRs: review within **2 hours** during business hours; on-call SRE may review outside hours.
- If a PR is waiting more than 2 business days, the author may escalate to the Engineering Manager.
- Teams track median review time on the engineering dashboard; the FY27 target is under 8 working hours.

## 5. What reviewers check

1. **Correctness** – does it do what the ticket says; edge cases; error handling.
2. **Security** – input validation, authorisation checks per tenant, no secrets in code, safe logging (no personal data or tokens), OWASP Top 10 issues (see Secure SDLC Standard, NIM/ENG/STD-005).
3. **Design** – fits the architecture (NIM/ENG/STD-001); no new data stores or external dependencies without an ADR.
4. **API contract** – compliant with the API Design Standard (NIM/ENG/STD-002), backward compatible.
5. **Operability** – structured logs, metrics and traces per NIM/ENG/STD-004; feature flag for risky behaviour; runbook updated if alerts change.
6. **Kubernetes manifests** – CPU and memory **requests and limits** set for every container; liveness and readiness probes defined; PodDisruptionBudget for services with more than 2 replicas. Manifests without limits are rejected by the `kube-linter` check and must not be overridden.
7. **Tests** – meaningful assertions, not just coverage; no flaky sleeps.
8. **Readability** – names, comments where intent is not obvious, no dead code.

## 6. Comment conventions

| Prefix | Meaning | Blocks merge? |
|---|---|---|
| `blocker:` | Must be fixed | Yes |
| `question:` | Reviewer needs to understand before approving | Yes, until answered |
| `suggestion:` | Improvement, author decides | No |
| `nit:` | Style or minor polish | No |
| `praise:` | Something done well | No |

Comment on the code, never the person. Prefer questions to commands. If a thread exceeds 3 back-and-forth replies, move to a call and record the outcome in the PR.

## 7. Author responsibilities

- Review your own diff before requesting review.
- Keep PRs focused: one concern per PR. Refactors go in separate PRs from behaviour changes.
- Respond to every comment (fix, reply, or create a follow-up ticket and link it).
- Do not merge with unresolved `blocker:` or `question:` comments.

## 8. Automated checks (required)

| Check | Tool | Gate |
|---|---|---|
| Lint / format | golangci-lint, ESLint, Prettier, Black | Must pass |
| Unit tests | Go test, Jest, pytest | Must pass |
| Coverage on new code | SonarQube | ≥ 80% |
| SAST | Semgrep | No new High/Critical |
| Dependency scan (SCA) | Dependabot + Trivy | No new Critical |
| Secrets scan | Gitleaks | Must pass, no bypass |
| Kubernetes manifests | kube-linter | Must pass |
| API compatibility | oasdiff | No breaking change in an existing major version |

## 9. Exceptions

In a declared SEV1 or SEV2, the Incident Commander may approve merging a fix with one approval instead of two. A full retrospective review must be completed within 2 business days after the incident.

## 10. Metrics and audit

The Architecture Office samples 20 merged PRs per month across teams to check compliance with this standard; results go to the CTO's monthly engineering review. SOC 2 auditors also sample PRs to confirm every production change was reviewed by someone other than the author.
