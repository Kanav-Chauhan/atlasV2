# NimbusOps Database Failover Runbook

| Document No. | Version | Effective | Department | Classification | Approved by |
|---|---|---|---|---|---|
| NIM/ENG/RB-001 | 2.3 | 15 June 2026 | Infrastructure & SRE | Internal | Meera Iyer, Chief Technology Officer |

## 1. Scope

This runbook covers failover of the NimbusOps primary metadata database: Amazon RDS for PostgreSQL 16, cluster `nops-prod-pg01`, running Multi-AZ in AWS ap-south-1 (Mumbai) with a cross-region read replica `nops-dr-pg01` in ap-south-2 (Hyderabad). It does not cover the time-series store or Kafka (see NIM/ENG/RB-002).

NimbusOps commitments that drive this runbook:

| Objective | Target |
|---|---|
| Monthly availability SLO | 99.9% |
| Recovery Point Objective (RPO) | 15 min |
| Recovery Time Objective (RTO) | 1 h |
| Error budget per 30-day month | 43 min 12 s |

## 2. Alerts that lead here

| Alert | Condition | Severity |
|---|---|---|
| `NopsPgPrimaryDown` | `pg_up{cluster="nops-prod-pg01"} == 0` for 2 min | page (SEV1 candidate) |
| `NopsPgReplicationLagHigh` | DR replica lag > 300 s for 10 min | page |
| `NopsPgConnectionsSaturated` | active connections > 90% of `max_connections` (1,600) for 5 min | page |
| `NopsApiDbErrors` | API 5xx with `db_unavailable` > 2% for 3 min | page |

If `NopsPgReplicationLagHigh` fires on its own, the primary is healthy; do **not** fail over. Investigate the replica (network, `rds.logical_replication` slots, long transactions) and post in `#nops-sre`.

## 3. Before you start

1. Declare an incident in `#incidents` with `/incident declare`. A database outage affecting all tenants is **SEV1** (15-minute response; CISO and CTO are paged automatically). Follow NIM/ENG/RB-004 for roles.
2. The Incident Commander (IC) must approve every failover. Write "IC approves failover" in the incident channel before running any command.
3. Open the Grafana dashboard **NimbusOps / Postgres Overview** and the RDS console in a second tab.
4. Confirm your AWS role: `aws sts get-caller-identity` must show `nops-sre-breakglass`.

## 4. Decide which path to take

| Situation | Path |
|---|---|
| Single instance or AZ failure, region healthy | Section 5 – in-region failover |
| RDS did not fail over automatically within 5 min | Section 5, manual reboot with failover |
| Whole ap-south-1 region impaired (AWS Health Dashboard confirms) | Section 6 – regional failover to ap-south-2 |
| Data corruption / bad migration | Section 7 – point-in-time restore. Do **not** fail over; corruption replicates. |

## 5. In-region failover (Multi-AZ)

RDS normally fails over on its own in 60–120 seconds. Wait 5 minutes before forcing it.

```bash
# 1. Check status
aws rds describe-db-instances --db-instance-identifier nops-prod-pg01 \
  --region ap-south-1 --query 'DBInstances[0].[DBInstanceStatus,AvailabilityZone,SecondaryAvailabilityZone]'

# 2. Force failover to the standby
aws rds reboot-db-instance --db-instance-identifier nops-prod-pg01 \
  --force-failover --region ap-south-1

# 3. Watch until 'available'
watch -n 10 "aws rds describe-db-instances --db-instance-identifier nops-prod-pg01 \
  --region ap-south-1 --query 'DBInstances[0].DBInstanceStatus'"
```

4. The writer endpoint `nops-prod-pg01.cluster.ap-south-1.rds.amazonaws.com` does not change. Restart PgBouncer to drop stale connections:

```bash
kubectl -n nops-data rollout restart deployment/pgbouncer
kubectl -n nops-data rollout status deployment/pgbouncer --timeout=180s
```

5. Verify (Section 8).

## 6. Regional failover to ap-south-2 (Hyderabad)

Expected total time: 35–50 minutes. Data loss up to the replica lag at the moment of failure, which must be within the 15-minute RPO.

### 6.1 Record the replica lag

```bash
aws cloudwatch get-metric-statistics --namespace AWS/RDS --metric-name ReplicaLag \
  --dimensions Name=DBInstanceIdentifier,Value=nops-dr-pg01 --region ap-south-2 \
  --start-time $(date -u -d '-30 min' +%FT%TZ) --end-time $(date -u +%FT%TZ) \
  --period 60 --statistics Maximum
```

Post the last value in the incident channel. If lag exceeded 900 s, tell the IC: the RPO is breached and the CTO must approve customer communication about data loss.

### 6.2 Stop writers in the primary region

```bash
kubectl --context nops-prod-aps1 -n nops-app scale deployment \
  ingest-api alert-evaluator notifier --replicas=0
```

If the region's EKS API is unreachable, skip this step and note it in the timeline.

### 6.3 Promote the replica

```bash
aws rds promote-read-replica --db-instance-identifier nops-dr-pg01 \
  --backup-retention-period 7 --region ap-south-2
```

Promotion takes 5–15 minutes. Then enable Multi-AZ:

```bash
aws rds modify-db-instance --db-instance-identifier nops-dr-pg01 \
  --multi-az --apply-immediately --region ap-south-2
```

### 6.4 Point the DR cluster at the new primary

```bash
kubectl --context nops-dr-aps2 -n nops-data patch secret pg-writer \
  -p '{"stringData":{"host":"nops-dr-pg01.ap-south-2.rds.amazonaws.com"}}'
kubectl --context nops-dr-aps2 -n nops-app scale deployment \
  ingest-api alert-evaluator notifier --replicas=6
```

### 6.5 Switch DNS

Update the Route 53 failover record `api.nimbusops.example` and `app.nimbusops.example` to the ap-south-2 load balancer. TTL is 60 seconds.

```bash
./scripts/dns-failover.sh --target aps2 --confirm
```

## 7. Point-in-time restore (corruption)

1. Identify the last good timestamp from the audit log or the migration start time.
2. Restore to a new instance: `aws rds restore-db-instance-to-point-in-time --source-db-instance-identifier nops-prod-pg01 --target-db-instance-identifier nops-prod-pg01-pitr --restore-time <UTC>`.
3. Compare row counts on `tenants`, `monitors`, `alert_rules` with the Siddharth Rao-approved checklist in the DBA wiki before swapping.
4. Swap via the `pg-writer` secret as in 6.4. PITR backups are kept for 7 days.

## 8. Verification checklist

- [ ] `SELECT pg_is_in_recovery();` returns `f` on the writer.
- [ ] API synthetic check `nops-synthetic-login` green for 3 consecutive runs.
- [ ] `NopsApiDbErrors` resolved; API 5xx below 0.5%.
- [ ] Kafka consumer lag for `alert-evaluator` decreasing (dashboard **Kafka / Consumers**).
- [ ] Status page updated by the Communications Lead.

## 9. After the incident

- Keep the old primary; do not delete it for 72 hours.
- Fail back to ap-south-1 only in a planned change window, with a CAB-approved change request, within 10 business days.
- Post-incident review within 5 business days (NIM/ENG/RB-004).

## 10. Contacts

| Role | Name | Channel |
|---|---|---|
| Runbook owner | Pradeep Joshi | `#nops-sre` |
| Database architect | Siddharth Rao | PagerDuty "NimbusOps DBA" |
| NimbusOps engineering | Neha Gupta | PagerDuty "NimbusOps Eng" |
| AWS Enterprise Support | TAM via console case, severity "Business-critical" | — |
