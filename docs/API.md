# Atlas v2 API contract

The web app proxies `/api/*` to the API (`next.config.ts` rewrite), so the browser's cookies reach the API.

## Who is calling (until Clerk, Phase 10)

The login page sets the httpOnly cookie `atlas_demo_user=<email>`. The API reads that cookie and
loads the user from the database (`users.email`). No cookie or unknown email → `401`.
Every query is scoped to that user's organization. Nothing crosses organizations.

## Access rule (one place: `atlas_api/access.py`)

A user can read a document when it belongs to their organization and:
- `document.access == "Everyone"`, or
- `document.access` is one of the user's departments, or
- the user's role is `admin`.

The same rule becomes a SQL `WHERE` filter on chunks (`org_id`, `access`) in Phase 4.

## Endpoints (Phase 3)

| Method | Path | Who | Returns |
|---|---|---|---|
| GET | `/me` | any user | `{email, name, title, role, departments: [str], org: {slug, name}}` |
| GET | `/documents` | any user | documents the user can read: `[{id, title, doc_no, access, is_public, format, status, error, pages, chunks, version, effective, superseded_by, updated_at}]`, newest first. `status`: `queued`, `processing`, `ready`, `failed`. Optional `?q=` filters by title, `?access=` by department. |
| GET | `/documents/{id}/file` | users who can read it | the original file (PDF/DOCX/MD) |
| POST | `/documents` | admin, or manager uploading into one of their own departments | multipart `file` + `access` (+ optional `is_public` admin only). Saves the file, creates the row with `status=queued`, queues the Celery task, returns the document. Max 10 MB; pdf/docx/md/txt only. |
| DELETE | `/documents/{id}` | admin, or a manager of that document's department | `204`, removes the file, row and chunks |
| GET | `/departments` | any user | the org's departments `[{name, description, members}]` |

Errors are `{"detail": "<plain English>"}`.

## Endpoints (Phase 4: retrieval)

| Method | Path | Who | Returns |
|---|---|---|---|
| POST | `/search` | any user | body `{q, top_k?: 5}` → `{q, took_ms, results: [{chunk_id, document_id, title, doc_no, access, page, section, text, score, superseded}]}`. Mode is always `hybrid_rerank`. Only documents the user can read (pre-filter). Empty `q` → 422. |
| POST | `/search/lab` | admin (super admin later) | body `{q, as_email?: str}` (a user of the same org; default = caller) → `{q, as_email, took_ms: {vector, keyword, fusion, rerank}, stages: {vector: [Hit], keyword: [Hit], fused: [Hit], reranked: [Hit]}}`, each `Hit = {chunk_id, document_id, title, page, section, text (first 300 chars), score, rank}`, top 20 per stage (reranked top 5). |
| GET | `/documents/{id}/chunks` | users who can read it | `[{chunk_id, index, page, section, tokens, text}]` in document order |
| GET | `/evals/latest` | admin | the latest retrieval eval run summary `{run_id, created_at, modes: {vector|hybrid|hybrid_rerank: {hit_at_1, hit_at_3, hit_at_5, mrr, context_recall, leaks, n}}}` or 404 |
