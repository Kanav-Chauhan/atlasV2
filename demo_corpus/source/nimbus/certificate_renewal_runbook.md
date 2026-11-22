---
title: Certificate Renewal Runbook
access: Engineering
format: md
doc_no: NIM/ENG/RB-005
version: 1.2
effective: 10 February 2026
review: 09 February 2027
classification: Internal
department: Infrastructure & SRE
prepared_by: Pradeep Joshi, Head of Infrastructure & SRE
approved_by: Sameer Khan, Chief Information Security Officer
stamp: none
---
# Certificate Renewal Runbook

## 1. Purpose

An expired certificate is a self-inflicted outage. This runbook lists every class of TLS certificate used by NimbusOps and internal platforms, how each is renewed, and what to do when automation fails.

## 2. Certificate inventory

| Class | Example names | Issuer | Validity | Renewal | Owner |
|---|---|---|---|---|---|
| Public ingress (automated) | `app.nimbusops.example`, `api.nimbusops.example`, `status.nimbusops.example` | Let's Encrypt via cert-manager | 90 days | Auto at 30 days before expiry | SRE |
| Public OV certificate (agent endpoint) | `ingest.nimbusops.example` | Commercial CA (OV) | 397 days | Manual, starts at 45 days | SRE + ITS |
| Internal mTLS (service mesh) | `*.nops-app.svc` | Internal CA (AWS Private CA) | 30 days | Auto at 10 days | SRE |
| Kafka client certificates | `alert-evaluator`, `notifier` | AWS Private CA | 365 days | Manual, starts at 30 days | NimbusOps Eng |
| Corporate (VPN, intranet, SSO) | `vpn.nimbus.example`, `intranet.nimbus.example` | Commercial CA | 397 days | Manual | IT Infrastructure |

The agent endpoint uses an OV certificate because some customer firewalls pin the issuing CA; the customer-facing pinning list is published in the NimbusOps agent docs and must be checked before changing CA.

## 3. Monitoring and alerts

All endpoints are probed by the blackbox exporter every 5 minutes.

| Alert | Condition | Action |
|---|---|---|
| `CertExpiringSoon` | expiry < 21 days | Ticket auto-created in `SRE`, Slack `#nops-sre` |
| `CertExpiryCritical` | expiry < 7 days | Page primary on-call |
| `CertManagerRenewalFailed` | `certmanager_certificate_ready_status{condition="False"} == 1` for 1 h | Page primary on-call |
| `CertExpired` | expiry < 0 | SEV1 if customer-facing |

## 4. Automated certificates (cert-manager)

### 4.1 Check status

```bash
kubectl get certificates -A
kubectl -n ingress describe certificate nimbusops-public-tls
kubectl -n ingress get certificaterequests,orders,challenges
```

### 4.2 Common failures

| Symptom | Cause | Fix |
|---|---|---|
| Challenge stuck `pending` | DNS-01 TXT record not created; IAM role for Route 53 missing | Check `cert-manager` service account annotation; re-apply `infra/iam/cert-manager.tf` |
| `429 rateLimited` from Let's Encrypt | Too many failed orders (5 failures/hour/account/hostname) | Wait one hour; fix root cause first; do not loop retries |
| Certificate issued but ingress serves old cert | Ingress controller did not reload | `kubectl -n ingress rollout restart deploy/ingress-nginx-controller` |

### 4.3 Force renewal

```bash
cmctl renew -n ingress nimbusops-public-tls
cmctl status certificate -n ingress nimbusops-public-tls
```

## 5. Manual renewal – OV certificate for `ingest.nimbusops.example`

Start no later than **45 days before expiry**. The CA's validation can take up to 5 business days.

1. Raise a change request in the CAB tool (standard change, template `CERT-RENEW`).
2. Generate the key and CSR on the hardened admin host (never on a laptop):

```bash
openssl req -new -newkey rsa:3072 -nodes \
  -keyout ingest.nimbusops.example.key -out ingest.nimbusops.example.csr \
  -subj "/C=IN/ST=Maharashtra/L=Pune/O=Nimbus Infotech Pvt. Ltd./CN=ingest.nimbusops.example"
```

3. Submit the CSR through the CA portal. The CISO's office (ITS) holds the CA account; request via `#its-requests`.
4. Store the key and issued chain in AWS Secrets Manager, secret `nops/prod/ingest-tls`, in **both** ap-south-1 and ap-south-2.
5. External Secrets syncs the secret into the cluster within 5 minutes. Verify:

```bash
echo | openssl s_client -connect ingest.nimbusops.example:443 -servername ingest.nimbusops.example 2>/dev/null \
  | openssl x509 -noout -dates -issuer -subject
```

6. Run the agent compatibility smoke test: `nopsctl agent smoketest --versions 5.x,6.x`. Agents older than 5.0 are unsupported.
7. Securely delete local key and CSR files (`shred -u`). Close the change.

## 6. Kafka client certificates

```bash
./scripts/kafka-cert-renew.sh --client alert-evaluator --days 365
kubectl -n nops-app rollout restart deployment/alert-evaluator
```

Renew one consumer group at a time and watch lag (NIM/ENG/RB-002) for 15 minutes between groups.

## 7. Emergency: certificate already expired

1. Declare **SEV1** if customers are affected (browsers or agents failing).
2. For Let's Encrypt names, force renewal (4.3). If ACME is down, switch the ingress to the standby wildcard certificate held in Secrets Manager (`nops/prod/wildcard-standby`, valid until 30 November 2026):

```bash
kubectl -n ingress patch ingress nimbusops-public --type=json \
  -p='[{"op":"replace","path":"/spec/tls/0/secretName","value":"wildcard-standby-tls"}]'
```

3. For the OV certificate, the CA offers emergency reissue within 4 hours on the enterprise plan; the CISO's office calls the CA's priority line.

## 8. Rules

- Minimum key size RSA 3072 or ECDSA P-256. TLS 1.2 minimum; TLS 1.3 preferred.
- Private keys never in Git, tickets, chat or email.
- Every manual certificate has an owner and a calendar reminder at 60, 45 and 30 days.
- Quarterly, SRE exports the inventory (`./scripts/cert-inventory.sh`) and ITS reviews it.
