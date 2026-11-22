---
title: NimbusOps Platform Architecture
access: Engineering
format: pdf
doc_no: NIM/ENG/STD-001
version: 4.0
effective: 01 April 2026
review: 31 March 2027
classification: Confidential
department: Engineering – NimbusOps
prepared_by: Siddharth Rao, Principal Architect
approved_by: Meera Iyer, Chief Technology Officer
stamp: APPROVED
---
# NimbusOps Platform Architecture

## 1. Introduction

NimbusOps is Nimbus Infotech's IT operations monitoring SaaS, used by about 140 customers. It collects metrics, events and logs from customer infrastructure through a lightweight agent, evaluates alert rules, and notifies on-call teams. This document is the reference architecture for engineers joining the product and the baseline against which design reviews are held.

## 2. Key figures (March 2026)

| Measure | Value |
|---|---|
| Customers | ~140 (61 enterprise, 79 mid-market) |
| Monitored hosts | ~186,000 |
| Datapoints ingested per day | ~2.1 billion |
| Peak ingest | ~210,000 messages/second |
| Alert rules evaluated | ~1.3 million active rules |
| Notifications sent per month | ~9.5 million |
| Availability SLO | 99.9% monthly |
| RPO / RTO | 15 min / 1 h |

## 3. Design principles

1. **Stateless services, stateful managed stores.** Application pods hold no state; state lives in PostgreSQL, Kafka, the time-series store and S3.
2. **Multi-tenant by default, isolated by key.** Every record carries `tenant_id`; row-level security is enforced in PostgreSQL.
3. **Back-pressure over loss.** Kafka absorbs bursts; services slow down rather than drop data.
4. **Region-pair resilience.** Everything that matters can run in the DR region within the RTO.
5. **Data residency in India.** All customer data is stored in Indian AWS regions; no replication outside India.

## 4. Deployment topology

| Item | Primary | Disaster recovery |
|---|---|---|
| AWS region | ap-south-1 (Mumbai) | ap-south-2 (Hyderabad) |
| Kubernetes | Amazon EKS 1.30, cluster `nops-prod-aps1` | EKS cluster `nops-dr-aps2`, warm standby at ~30% capacity |
| Relational DB | Amazon RDS for PostgreSQL 16, Multi-AZ, `db.r6g.4xlarge` | Cross-region read replica |
| Streaming | Amazon MSK (Kafka 3.6), 6 brokers, 3 AZs | MSK cluster, 3 brokers, MirrorMaker 2 replication |
| Time-series store | VictoriaMetrics cluster on EKS (stream node group), 13 months retention | Downsampled replica, 13 months |
| Object storage | S3 (log archive, exports, backups) | S3 cross-region replication |
| Edge | CloudFront + AWS WAF + ALB | ALB, Route 53 failover records |

## 5. Logical components

### 5.1 Ingestion tier

- **NimbusOps Agent** (Go, versions 5.x and 6.x supported) runs on customer hosts and sends batches over HTTPS/TLS 1.3 to `ingest.nimbusops.example`, authenticated by a per-tenant API key.
- **ingest-api** validates, applies per-tenant rate limits (default 20,000 datapoints/second) and writes to Kafka topics `metrics.raw` and `events.raw`.

### 5.2 Processing tier

- **ingest-processor** consumes `metrics.raw`, enriches with host metadata and writes to VictoriaMetrics.
- **event-normaliser** maps events from 40+ integrations (AWS CloudWatch, Azure Monitor, VMware, ServiceNow and others) into a common schema.
- **alert-evaluator** evaluates rules every 30 seconds (60 seconds on the Starter plan) and publishes state changes to `alerts.evaluate` and `notifications.out`.
- **notifier** delivers email, SMS, Slack, Microsoft Teams, webhook and PagerDuty notifications, with retries for 24 hours.

### 5.3 Presentation tier

- **web-ui** (React, served from CloudFront) and **public-api** (REST, `/v1`, see NIM/ENG/STD-002).
- **query-service** fronts VictoriaMetrics and PostgreSQL with per-tenant query limits (max 50 concurrent queries per tenant).

### 5.4 Platform services

- Identity: customer SSO via SAML 2.0 and OIDC; internal staff via the corporate IdP with MFA.
- Secrets: AWS Secrets Manager synced by External Secrets Operator.
- Service mesh: Linkerd with mTLS between all pods (certificates rotated every 30 days).
- Observability: OpenTelemetry, Prometheus, Grafana, Loki (see NIM/ENG/STD-004). NimbusOps also monitors itself from an isolated "meta" tenant.

## 6. Data flow summary

1. Agent → CloudFront/WAF → ALB → ingest-api.
2. ingest-api → Kafka (`metrics.raw`, `events.raw`).
3. Consumers → VictoriaMetrics / PostgreSQL.
4. alert-evaluator → `alerts.evaluate` → notifier → customer channels.
5. web-ui / public-api → query-service → stores.

End-to-end target: a threshold breach on a customer host produces a notification within **90 seconds** at p95.

## 7. Data stores and retention

| Data | Store | Retention |
|---|---|---|
| Raw metrics | VictoriaMetrics | 15 days at full resolution, 13 months at 5-min rollups |
| Events | PostgreSQL (partitioned monthly) | 13 months |
| Logs (customer) | Loki + S3 | 30 days (Standard), 90 days (Enterprise) |
| Configuration (tenants, monitors, rules) | PostgreSQL | Life of contract + 90 days |
| Audit log | PostgreSQL + S3 Object Lock | 1 year |
| Backups (RDS automated) | RDS snapshots | 7 days PITR, 35 days daily snapshots |

On contract termination, customer data is deleted within 90 days and a deletion certificate is issued on request.

## 8. Security architecture

- Network: private subnets for all workloads; only ALBs are public. Security groups follow least privilege; changes via Terraform only.
- Encryption: TLS 1.2+ in transit (1.3 for agent traffic); AES-256 at rest with AWS KMS customer-managed keys, rotated yearly.
- Tenant isolation: PostgreSQL row-level security plus a `tenant_id` filter enforced in query-service; automated cross-tenant tests run in CI on every release.
- Compliance: SOC 2 Type II (NimbusOps), ISO 27001:2022 (company-wide). Annual external penetration test.

## 9. Capacity and scaling

| Component | Scaling | Current headroom |
|---|---|---|
| ingest-api | HPA on CPU (target 60%), 8–48 pods | 2.4x peak |
| alert-evaluator | HPA on Kafka lag, 12–36 pods | 1.8x peak |
| VictoriaMetrics | Manual, storage nodes added in pairs | 55% disk used |
| RDS | Vertical; read replicas for reporting | 38% CPU at peak |

Capacity is reviewed monthly; a scaling plan is required when any component's headroom falls below 1.5x.

## 10. Known limitations and roadmap (FY27)

- Single primary PostgreSQL limits write throughput; sharding by tenant is planned for Q3 FY27.
- DR warm standby is at ~30% capacity; regional failover therefore relies on Karpenter scale-out within the RTO.
- Planned: EU data region (Frankfurt) for Middle East/Europe customers, subject to the FY27 budget.

## 11. Architecture governance

Changes that add a new data store, a new external dependency, or affect tenant isolation require an Architecture Decision Record (ADR) reviewed by the Architecture Review Board, chaired by Siddharth Rao, which meets every Thursday at 15:00 IST.
