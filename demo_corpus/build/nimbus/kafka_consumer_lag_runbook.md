# Kafka Consumer Lag Runbook

| Document No. | Version | Effective | Department | Classification | Approved by |
|---|---|---|---|---|---|
| NIM/ENG/RB-002 | 1.6 | 02 May 2026 | Infrastructure & SRE | Internal | Pradeep Joshi, Head of Infrastructure & SRE |

## 1. Purpose

NimbusOps ingests customer telemetry through Kafka (Amazon MSK, Kafka 3.6, 6 brokers across 3 AZs in ap-south-1). When consumers fall behind, alerts reach customers late, which directly hurts the product. This runbook explains how to diagnose and clear consumer lag.

## 2. Topics and consumer groups

| Topic | Partitions | Retention | Consumer group | Normal lag |
|---|---|---|---|---|
| `metrics.raw` | 96 | 24 h | `ingest-processor` | < 50,000 msgs |
| `events.raw` | 48 | 72 h | `event-normaliser` | < 10,000 msgs |
| `alerts.evaluate` | 48 | 24 h | `alert-evaluator` | < 2,000 msgs |
| `notifications.out` | 24 | 72 h | `notifier` | < 500 msgs |
| `audit.log` | 12 | 7 days | `audit-sink` | < 20,000 msgs |

Peak ingest is about 210,000 messages per second on `metrics.raw` between 09:30 and 11:30 IST.

## 3. Alerts

| Alert | Condition | Action |
|---|---|---|
| `KafkaConsumerLagWarning` | lag > 5x normal for 10 min | Slack `#nops-sre`, no page |
| `KafkaConsumerLagCritical` | `alert-evaluator` lag > 20,000 **or** time lag > 120 s for 5 min | Page primary on-call |
| `KafkaConsumerGroupEmpty` | group has 0 members for 2 min | Page primary on-call |
| `KafkaUnderReplicatedPartitions` | > 0 for 10 min | Page, see Section 7 |

Time lag (seconds behind newest offset) matters more than message count. If `alert-evaluator` time lag exceeds **300 seconds**, declare a **SEV2** (degraded service, 30-minute response). If it exceeds 15 minutes for all tenants, upgrade to **SEV1**.

## 4. First five minutes

```bash
# Who is lagging and by how much
kafka-consumer-groups.sh --bootstrap-server $MSK_BOOTSTRAP \
  --command-config /etc/kafka/client.properties \
  --describe --group alert-evaluator | sort -k6 -n -r | head -20

# Are the pods healthy?
kubectl -n nops-app get pods -l app=alert-evaluator -o wide
kubectl -n nops-app top pods -l app=alert-evaluator
```

Answer three questions in the incident channel:

1. Is lag on **all partitions** (throughput problem) or **a few partitions** (hot key or stuck consumer)?
2. Did a deploy happen in the last 2 hours? Check `#deploys` and `argocd app history nops-alert-evaluator`.
3. Is ingest volume abnormal? Check Grafana **Kafka / Topic Throughput**: compare to the same hour last week.

## 5. Common causes and fixes

### 5.1 Consumers too slow for volume (lag on all partitions)

Scale out. The maximum useful replica count equals the partition count (48 for `alert-evaluator`).

```bash
kubectl -n nops-app scale deployment alert-evaluator --replicas=36
```

HPA limits: min 12, max 36 replicas. Going above 36 requires manually editing the HPA and notifying Neha Gupta. Each pod needs 2 vCPU / 4 GiB; check the node group has room (NIM/ENG/RB-003).

### 5.2 Stuck partition (lag on 1–3 partitions)

Usually a poison message that crashes the consumer in a loop.

```bash
kubectl -n nops-app logs -l app=alert-evaluator --since=15m | grep -i "deserial\|exception" | head
```

If one offset keeps failing, the consumer should already send it to `alerts.evaluate.dlq` after 5 retries. If it is not doing so, skip the offset manually (IC approval required, record the offset in the incident):

```bash
kafka-consumer-groups.sh --bootstrap-server $MSK_BOOTSTRAP \
  --command-config /etc/kafka/client.properties --group alert-evaluator \
  --topic alerts.evaluate:17 --reset-offsets --shift-by 1 --execute
```

The group must be stopped (scale to 0) before an offset reset, then scaled back.

### 5.3 Rebalance storm

Symptom: `KafkaConsumerGroupEmpty` flapping, logs show `Attempt to heartbeat failed since group is rebalancing`. Cause is usually pods being OOM-killed or `max.poll.interval.ms` (300,000 ms) exceeded by slow batches.

- Check `kubectl get events -n nops-app --field-selector reason=OOMKilled`.
- Temporarily reduce `max.poll.records` from 500 to 200 via the config map `alert-evaluator-config` and restart.

### 5.4 Noisy tenant

A single tenant sending a burst (e.g. a misconfigured agent) can flood `metrics.raw`. Find it:

```bash
nopsctl ingest top-tenants --window 15m --limit 10
```

Apply the per-tenant ingest throttle (default 20,000 datapoints/s, emergency cap 5,000):

```bash
nopsctl tenant throttle --tenant <tenant_id> --rate 5000 --duration 2h
```

Inform the account's Customer Success Manager before the throttle runs longer than 2 hours.

## 6. Catch-up mode

When the backlog is large (> 15 minutes), enable catch-up so stale metric samples older than 10 minutes are aggregated instead of evaluated individually:

```bash
nopsctl feature-flag set alert-evaluator.catchup_mode true
```

Turn it off once time lag is under 60 seconds. Leaving it on hides short alert spikes.

## 7. Broker problems

If `KafkaUnderReplicatedPartitions` is firing or a broker is offline, this is not a consumer problem. Open an AWS support case (Business-critical) and page Pradeep Joshi. Do not restart consumers repeatedly; it makes rebalancing worse.

## 8. Recovery criteria

The incident can be resolved when, for 30 minutes continuously:

- `alert-evaluator` time lag < 30 s;
- `notifier` lag < 500 messages;
- DLQ growth rate is zero or explained.

## 9. Escalation

| After | Escalate to |
|---|---|
| 30 min without lag trending down | Secondary on-call + Neha Gupta |
| 60 min, or SEV1 | Pradeep Joshi, Meera Iyer (CTO) |
| Data loss suspected (retention exceeded) | Siddharth Rao and the CISO, Sameer Khan |
