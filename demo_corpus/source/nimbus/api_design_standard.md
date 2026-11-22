---
title: API Design Standard
access: Engineering
format: pdf
doc_no: NIM/ENG/STD-002
version: 2.2
effective: 01 January 2026
review: 31 December 2026
classification: Internal
department: Engineering – Architecture Office
prepared_by: Siddharth Rao, Principal Architect
approved_by: Meera Iyer, Chief Technology Officer
stamp: APPROVED
---
# API Design Standard

## 1. Purpose and scope

This standard defines how Nimbus Infotech designs HTTP APIs, both for NimbusOps (public and internal) and for client projects where the client has no standard of its own. Consistent APIs reduce integration effort for customers and review effort for us. The words **must**, **should** and **may** are used as in RFC 2119.

## 2. General rules

1. APIs **must** be described in OpenAPI 3.1 before implementation begins. The spec lives in the service repository under `api/openapi.yaml` and is reviewed in the same PR as the first implementation.
2. APIs **must** use HTTPS only, TLS 1.2 minimum.
3. Request and response bodies **must** be JSON (`application/json`, UTF-8).
4. Field names **must** use `snake_case`. Resource paths use lowercase, plural nouns and hyphens: `/v1/alert-rules`.
5. Timestamps **must** be ISO 8601 in UTC with a `Z` suffix (e.g. `2026-06-11T09:42:07Z`). Durations in seconds as integers.
6. Identifiers are opaque strings with a type prefix: `ten_`, `mon_`, `rul_` (e.g. `rul_8f2k1q`). Never expose database sequence IDs.

## 3. Resource design and methods

| Method | Use | Idempotent | Success code |
|---|---|---|---|
| GET | Read a resource or list | Yes | 200 |
| POST | Create, or trigger an action (`/v1/monitors/{id}:mute`) | No (use `Idempotency-Key`) | 201 / 202 |
| PUT | Full replace | Yes | 200 |
| PATCH | Partial update (JSON Merge Patch) | Yes | 200 |
| DELETE | Remove | Yes | 204 |

- POST endpoints that create resources **must** accept an `Idempotency-Key` header; the server keeps keys for 24 hours.
- Long-running operations return `202 Accepted` with a `Location` header pointing to `/v1/operations/{id}`.
- Nesting is limited to one level: `/v1/monitors/{id}/incidents` is fine, deeper is not.

## 4. Versioning

- The major version is in the path: `/v1`, `/v2`.
- Within a major version, only **additive** changes are allowed: new optional fields, new endpoints, new enum values (clients must tolerate unknown values).
- Breaking changes require a new major version and an ADR approved by the Architecture Review Board.
- Deprecation: a deprecated version or endpoint **must** remain available for at least **12 months** after the deprecation announcement for public APIs and **6 months** for partner/internal APIs. Responses carry `Deprecation` and `Sunset` headers.

## 5. Pagination, filtering, sorting

- List endpoints **must** paginate using cursors: `?limit=50&cursor=<opaque>`. Default page size **50**, maximum **200**.
- Responses include `next_cursor` (null on the last page). Offset pagination is not allowed on new APIs.
- Filters use field names as query parameters (`?status=open&severity=critical`). Sorting: `?sort=-created_at` (minus = descending).

## 6. Errors

Errors **must** follow RFC 9457 (Problem Details):

```json
{
  "type": "https://docs.nimbusops.example/errors/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Tenant ten_4k2 exceeded 600 requests per minute.",
  "instance": "/v1/alert-rules",
  "request_id": "req_01J0Z7Q2"
}
```

| Code | When |
|---|---|
| 400 | Malformed request, validation failure (include `errors[]` with field paths) |
| 401 | Missing/invalid credentials |
| 403 | Authenticated but not allowed |
| 404 | Not found **or** belongs to another tenant (never 403 for cross-tenant) |
| 409 | Conflict (duplicate name, version mismatch) |
| 422 | Semantically invalid (e.g. threshold below zero) |
| 429 | Rate limited; include `Retry-After` |
| 5xx | Server errors; never leak stack traces |

## 7. Security

- Public APIs authenticate with API keys (header `Authorization: Bearer <key>`) or OAuth 2.0 client credentials. Keys are scoped (`read`, `write`, `admin`) and can be rotated without downtime.
- Every request **must** be authorised against the caller's tenant in the service layer, not only at the gateway.
- Input validation against the OpenAPI schema is enforced by middleware; unknown fields are rejected on write.
- APIs **must not** return secrets, full API keys, or personal data beyond what the use case needs (see DPDP Act 2023 obligations in the Data Protection Policy).

## 8. Rate limiting

| Plan | Requests per minute per API key | Burst |
|---|---|---|
| Starter | 120 | 20 |
| Standard | 300 | 50 |
| Enterprise | 600 | 100 |
| Internal service-to-service | 3,000 | 500 |

Responses include `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset` headers.

## 9. Performance targets

| Endpoint type | p95 latency | p99 latency |
|---|---|---|
| Single-resource GET | 150 ms | 400 ms |
| List (≤ 200 items) | 300 ms | 800 ms |
| Write | 250 ms | 600 ms |
| Metric query (≤ 24 h range) | 800 ms | 1.5 s |

## 10. Observability

Every request logs `request_id`, `tenant_id`, route, status and duration, and propagates W3C `traceparent` headers as required by the Logging and Observability Standard (NIM/ENG/STD-004).

## 11. Review checklist

Before merging a new or changed API, the reviewer confirms: OpenAPI updated; naming rules met; pagination and errors per this standard; authorisation tested including a cross-tenant negative test; rate limits configured; changelog entry added; backward compatibility verified by the `oasdiff` CI check.

## 12. Ownership

This standard is owned by the Architecture Office (Siddharth Rao). Exceptions are recorded as ADRs.
