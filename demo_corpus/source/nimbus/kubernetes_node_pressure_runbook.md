---
title: Kubernetes Node Pressure Runbook
access: Engineering
format: md
doc_no: NIM/ENG/RB-003
version: 1.4
effective: 20 March 2026
review: 19 September 2026
classification: Internal
department: Infrastructure & SRE
prepared_by: Pradeep Joshi, Head of Infrastructure & SRE
approved_by: Meera Iyer, Chief Technology Officer
stamp: none
---
# Kubernetes Node Pressure Runbook

## 1. Scope

Applies to the NimbusOps EKS clusters:

| Cluster | Region | Kubernetes | Node groups |
|---|---|---|---|
| `nops-prod-aps1` | ap-south-1 (Mumbai) | 1.30 | `general` (m6i.2xlarge, 12–60 nodes), `stream` (r6i.2xlarge, 6–30), `system` (m6i.large, 3 fixed) |
| `nops-dr-aps2` | ap-south-2 (Hyderabad) | 1.30 | `general` (6–40), `stream` (3–20), `system` (3 fixed) |
| `nops-stg-aps1` | ap-south-1 | 1.31 | `general` (3–10) |

Nodes scale with Karpenter for `general` and `stream`; `system` is a managed node group.

## 2. Alerts

| Alert | Condition | Page? |
|---|---|---|
| `KubeNodeMemoryPressure` | node condition `MemoryPressure=True` for 2 min | Yes |
| `KubeNodeDiskPressure` | node condition `DiskPressure=True` for 2 min | Yes |
| `KubeNodePIDPressure` | node condition `PIDPressure=True` for 5 min | Yes |
| `NodeMemoryHigh` | memory working set > 85% for 15 min | No, Slack only |
| `NodeFilesystemAlmostFull` | root fs > 80% for 30 min | No, Slack only |
| `KubePodEvictionsHigh` | > 20 evictions in 10 min cluster-wide | Yes |

Kubelet eviction thresholds (hard): `memory.available<500Mi`, `nodefs.available<10%`, `imagefs.available<15%`, `pid.available<5%`. Soft thresholds: `memory.available<1Gi` with a 90 s grace period.

## 3. Triage

```bash
kubectl --context nops-prod-aps1 get nodes \
  -o custom-columns=NAME:.metadata.name,MEM:.status.conditions[?(@.type=="MemoryPressure")].status,DISK:.status.conditions[?(@.type=="DiskPressure")].status,PID:.status.conditions[?(@.type=="PIDPressure")].status

kubectl describe node <node> | sed -n '/Conditions/,/Addresses/p'
kubectl top node <node>
kubectl top pods -A --sort-by=memory | head -20
kubectl get pods -A --field-selector spec.nodeName=<node> -o wide
```

Decide:

- **One node** affected → usually one misbehaving pod. Go to Section 4.
- **Many nodes in one node group** → capacity or a bad rollout. Go to Section 5.
- **Disk pressure** → Section 6.

## 4. Single node

1. Identify the top consumer from `kubectl top pods` on that node. Compare with its memory limit.
2. If a pod has **no memory limit** (should not happen; the Code Review Standard NIM/ENG/STD-003 rejects manifests without limits), note it for the post-incident review.
3. Cordon and drain the node so Karpenter replaces it:

```bash
kubectl cordon <node>
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data \
  --grace-period=60 --timeout=10m
```

4. Respect PodDisruptionBudgets. If drain blocks on a PDB for more than 10 minutes, do **not** use `--disable-eviction`; page the service owner instead.
5. Once drained, the node is terminated by Karpenter within about 5 minutes. Confirm with `kubectl get nodeclaims`.

## 5. Node group under pressure

1. Check recent deploys: `argocd app list --output wide | grep -v Synced` and `#deploys`. A new release with a memory leak is the most common cause. If a release in the last 4 hours matches, roll back (NIM/ENG/SOP-002).
2. Check Karpenter is able to add nodes:

```bash
kubectl -n karpenter logs deploy/karpenter --since=20m | grep -i "error\|insufficient"
kubectl get nodepools general -o yaml | grep -A3 limits
```

The `general` NodePool CPU limit is 960 vCPU. If Karpenter reports the limit is reached, raise it to at most 1,280 vCPU with approval from the on-call SRE lead; anything higher needs Pradeep Joshi's approval because of cost (NIM/ENG/GDL-001).

3. Check for EC2 capacity errors (`InsufficientInstanceCapacity`). If so, add `m6a.2xlarge` and `m7i.2xlarge` as allowed instance types in the NodePool.
4. If customer impact is visible (API p99 > 1.5 s or 5xx > 1%), declare **SEV2**.

## 6. Disk pressure

Most disk pressure comes from container images or runaway logs.

```bash
# On the node via SSM
aws ssm start-session --target <instance-id> --region ap-south-1
sudo crictl images | wc -l
sudo du -sh /var/log/pods/* | sort -h | tail
sudo crictl rmi --prune
```

- Pods writing more than 1 GiB/hour of stdout logs breach the logging standard; set the pod's log level to `warn` and open a P2 ticket with the owning team.
- Root volume is 100 GiB gp3. Do not resize live volumes during an incident.

## 7. PID pressure

Usually a process forking in a loop (often a Java service with a thread leak).

```bash
sudo ps -eLf | awk '{print $2}' | sort | uniq -c | sort -nr | head
```

Restart the offending pod. Pod PID limit is 4,096 (`podPidsLimit`).

## 8. Verification

- [ ] No nodes report `MemoryPressure`, `DiskPressure` or `PIDPressure`.
- [ ] Evictions below 5 per 10 minutes.
- [ ] All Deployments in `nops-app` show `READY` = desired.
- [ ] Kafka consumer lag normal (NIM/ENG/RB-002).

## 9. Follow-up

- File a ticket in project `SRE` with the label `node-pressure`, linking dashboards and the timeline.
- If the cause was missing or wrong resource requests, the owning team must fix it within 10 business days.
- Review this runbook every six months; owner: Pradeep Joshi.
