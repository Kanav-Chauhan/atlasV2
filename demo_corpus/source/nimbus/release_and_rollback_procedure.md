---
title: Release and Rollback Procedure
access: Engineering
format: docx
doc_no: NIM/ENG/SOP-002
version: 3.2
effective: 05 May 2026
review: 04 May 2027
classification: Internal
department: Engineering – NimbusOps
prepared_by: Neha Gupta, Engineering Manager – NimbusOps
approved_by: Meera Iyer, Chief Technology Officer
stamp: APPROVED
---
# Release and Rollback Procedure

## 1. Purpose

This procedure describes how changes are released to NimbusOps production and how to roll them back safely. The aim is small, frequent, reversible releases with no customer surprise.

## 2. Release types

| Type | Cadence | Approval | Deployment method |
|---|---|---|---|
| Standard release (release train) | Weekly, Tuesday 11:00 IST | Release manager | Canary via Argo Rollouts |
| Hotfix | Any time | Engineering Manager + on-call SRE | Canary with shortened steps |
| Emergency fix during SEV1/SEV2 | Any time | Incident Commander | Direct, with IC approval |
| Infrastructure change (Terraform) | Wednesday/Thursday | CAB (weekly, Monday 16:00 IST) | Plan reviewed, then apply |
| Database schema migration | With release train | Principal Architect or delegate for destructive changes | Expand/contract pattern |

## 3. Release calendar and freezes

- **Release train:** branch cut every Monday 18:00 IST, staging soak Monday night, production Tuesday 11:00 IST. The release manager role rotates fortnightly among NimbusOps tech leads (L4).
- **No production releases** on Fridays after 14:00 IST, weekends, or public holidays observed in Pune, except hotfixes.
- **Quarter-end freeze:** last 3 business days of each quarter, as many customers run quarterly reporting.
- **Year-end freeze:** 20 December to 3 January for non-critical changes.
- **DR drill freeze:** from the Friday 18:00 IST before a full DR drill (NIM/ENG/SOP-001).

## 4. Pre-release checklist

The release manager confirms in `#deploys` that:

1. All PRs in the train meet the Code Review Standard (NIM/ENG/STD-003) and CI is green.
2. Staging has run the release for at least 12 hours without new error classes in the error tracker.
3. End-to-end regression suite pass rate is 100% for P1 tests (≈ 420 tests) and at least 98% overall.
4. Schema migrations are backward compatible (the previous version of the app can run against the new schema).
5. Feature flags for new functionality default to **off** in production.
6. Release notes are drafted; customer-visible changes are reviewed by Product.

## 5. Canary rollout

Production deploys use Argo Rollouts with automated analysis against Prometheus.

| Step | Traffic to new version | Hold | Automatic analysis |
|---|---|---|---|
| 1 | 5% | 10 min | Error rate, p99 latency |
| 2 | 25% | 15 min | Error rate, p99 latency, saturation |
| 3 | 50% | 15 min | As above + Kafka lag |
| 4 | 100% | — | Continued monitoring 60 min |

Automatic abort (the rollout reverts itself) when, compared with the stable version:

- HTTP 5xx rate above **1%** for 3 consecutive minutes, or
- p99 latency more than **30% higher** for 5 minutes, or
- `alert-evaluator` time lag above 120 seconds.

Hotfixes use steps of 10% (5 min) and 100%.

## 6. Commands

```bash
# Promote / watch a rollout
kubectl argo rollouts get rollout nops-api -n nops-app --watch
kubectl argo rollouts promote nops-api -n nops-app

# Manual abort (returns traffic to stable)
kubectl argo rollouts abort nops-api -n nops-app

# Roll back to the previous revision after full rollout
kubectl argo rollouts undo nops-api -n nops-app
argocd app sync nops-api --revision <previous-git-sha>
```

## 7. Rollback decision

Roll back first, investigate later. Any engineer on the release can trigger a rollback without asking permission when:

1. an automatic abort criterion is met but analysis did not trigger;
2. customers report a regression traced to the release;
3. a security issue is found in released code.

Target: rollback started within **10 minutes** of the decision and completed within **20 minutes**.

### 7.1 Rollback with schema migrations

Because migrations follow expand/contract, the previous application version always works with the expanded schema. **Never** run a down-migration in production during an incident. Contract steps (dropping columns or tables) must ship at least **two release trains** after the expand step, and require approval from Siddharth Rao (Principal Architect) or his delegate.

### 7.2 Feature flag rollback

If the problem is isolated to a flagged feature, turn the flag off instead of rolling back:

```bash
nopsctl feature-flag set <flag-name> false --env prod --reason "INC-xxxx"
```

## 8. Post-release

- Release manager posts "Release 2026.NN complete" with the version tag in `#deploys`.
- Monitor dashboards for 60 minutes after reaching 100%.
- Release notes are published to customers by 17:00 IST the same day.
- Any rollback is logged as at least a SEV3 incident and gets a short review in the Thursday engineering sync.

## 9. Metrics

| Metric (DORA) | FY27 target | FY26 actual |
|---|---|---|
| Deployment frequency (NimbusOps) | ≥ 3 per week | 2.4 per week |
| Lead time for change | < 3 days | 4.1 days |
| Change failure rate | < 10% | 12.6% |
| Time to restore (release-caused) | < 30 min | 38 min |

## 10. Roles

| Role | Responsibility |
|---|---|
| Release manager (rotating L4) | Runs the train, go/no-go, communication |
| On-call SRE | Watches platform health during rollout |
| Engineering Manager, NimbusOps (Neha Gupta) | Approves hotfixes, owns this procedure |
| CTO (Meera Iyer) | Approves exceptions to freezes |
