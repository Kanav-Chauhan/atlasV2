---
title: Logging and Observability Standard
access: Engineering
format: docx
doc_no: NIM/ENG/STD-004
version: 2.0
effective: 01 February 2026
review: 31 January 2027
classification: Internal
department: Infrastructure & SRE
prepared_by: Pradeep Joshi, Head of Infrastructure & SRE
approved_by: Sameer Khan, Chief Information Security Officer
stamp: APPROVED
---
# Logging and Observability Standard

## 1. Purpose

Engineers cannot fix what they cannot see, and auditors expect us to prove who did what and when. This standard defines the minimum logging, metrics, tracing and alerting every Nimbus-built service must provide. It applies to NimbusOps, internal platforms, and client systems that Nimbus operates under managed services.

## 2. Telemetry stack

| Signal | Collection | Storage / UI |
|---|---|---|
| Logs | OpenTelemetry Collector (DaemonSet) | Loki, archived to S3; Grafana |
| Metrics | Prometheus exporters, OTel SDK | Prometheus (short term) → VictoriaMetrics; Grafana |
| Traces | OTel SDK, W3C Trace Context | Grafana Tempo |
| Errors | Sentry SDK | Sentry (self-hosted, ap-south-1) |
| Paging | Alertmanager → PagerDuty | PagerDuty |

## 3. Log format

All application logs **must** be structured JSON, one object per line, written to stdout. Required fields:

| Field | Example | Notes |
|---|---|---|
| `ts` | `2026-06-11T09:42:07.312Z` | ISO 8601, UTC, millisecond precision |
| `level` | `info` | `debug`, `info`, `warn`, `error`, `fatal` |
| `service` | `alert-evaluator` | Matches the `service` tag |
| `version` | `2026.23.1` | Release version |
| `env` | `prod` | |
| `msg` | `rule evaluation complete` | Human-readable, no variable data in the message text |
| `trace_id` / `span_id` | `4bf92f3577b34da6...` | From the active span |
| `tenant_id` | `ten_4k2` | Required for any tenant-scoped operation |
| `request_id` | `req_01J0Z7Q2` | For request-driven services |

Production default log level is `info`. `debug` may be enabled in production for at most **2 hours** using the dynamic log-level flag, and must be recorded in the incident or change ticket.

## 4. What must never be logged

- Passwords, API keys, session tokens, OAuth secrets, private keys, full JWTs.
- Payment card data, Aadhaar or PAN numbers, bank account numbers.
- Personal data beyond the minimum: log user IDs, not names, emails or phone numbers.
- Customer payloads (metric labels may contain customer data; log counts, not contents).

The shared logging libraries (`nimbus-log` for Go, `@nimbus/log` for Node.js) redact known secret patterns automatically, but developers remain responsible. Any leak found must be reported to `security@nimbus.example` and the affected logs purged within 24 hours.

## 5. Audit logs

Security-relevant events **must** be written to the audit stream (Kafka topic `audit.log`), separate from application logs:

- sign-in success/failure, MFA events, SSO configuration changes;
- creation, change or deletion of users, roles, API keys;
- access to customer data by Nimbus staff (support "break-glass" access);
- configuration changes to alert rules and integrations;
- data exports and deletion requests.

Audit records are immutable (S3 Object Lock, compliance mode).

## 6. Retention

| Data | Hot (searchable) | Archive | Total |
|---|---|---|---|
| Application logs – production | 14 days (Loki) | S3, 180 days | 180 days |
| Application logs – non-production | 7 days | none | 7 days |
| Audit logs | 90 days | S3 Object Lock | 1 year |
| Infrastructure/system logs (VPC flow logs, CloudTrail, EKS control plane) | 30 days | S3 | 180 days minimum |
| Metrics | 15 days raw | 5-min rollups | 13 months |
| Traces | 7 days | sampled exemplars only | 7 days |

The 180-day minimum for system logs meets the CERT-In Directions of April 2022, which require ICT system logs to be maintained securely within India for a rolling 180 days. All log storage is in AWS ap-south-1 / ap-south-2.

## 7. Metrics

Every service **must** expose on `/metrics`:

- the four golden signals: request rate, error rate, latency histogram (`*_duration_seconds` with standard buckets), saturation (queue depth, worker utilisation);
- build info (`service_build_info{version="..."}`);
- for Kafka consumers: consumer lag in messages and seconds.

Label cardinality: a single metric must not exceed **10,000 active series** per service. `tenant_id` may be used as a label only on metrics listed in the approved high-cardinality register.

## 8. Tracing

- Propagate W3C `traceparent` and `tracestate` headers across HTTP, gRPC and Kafka (as message headers).
- Sampling: 100% of errors, 10% head-based sampling for successful requests in production, 100% in staging.

## 9. SLOs and alerting

- Each customer-facing service defines at least one availability SLI and one latency SLI, with SLO targets that roll up to the NimbusOps 99.9% monthly availability SLO.
- Paging alerts are based on **error-budget burn rate**: page when 2% of the monthly budget burns in 1 hour (fast burn) or 5% in 6 hours (slow burn).
- Every paging alert must link a runbook in the `runbook_url` annotation (see On-Call Policy, NIM/ENG/POL-001).
- Non-actionable alerts go to Slack, never to PagerDuty.

## 10. Dashboards

Each service has a standard Grafana dashboard generated from the `service-dashboard` template (golden signals, dependencies, Kafka lag, pod resources). Dashboards are stored as code in `observability/dashboards/` and changed via PR.

## 11. Cost control

Logs are the largest observability cost. Limits:

- Per-service log volume budget: **20 GB/day** in production unless approved by Pradeep Joshi.
- A pod writing more than 1 GiB/hour triggers `LogVolumeHigh` and a ticket to the owning team.
- Health-check and readiness-probe requests must not be logged at `info`.

## 12. Compliance and review

ITS reviews audit log coverage every six months as part of ISO 27001 internal audit. New services must pass the observability checklist in the production readiness review before first production release.
