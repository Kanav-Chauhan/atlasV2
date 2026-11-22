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

## Endpoints (Phase 5: answering)

The Ask page uses the Vercel AI SDK `useChat` with `DefaultChatTransport({ api: "/api/chat" })`, so `/chat` speaks the
**AI SDK UI message stream** (SSE, header `x-vercel-ai-ui-message-stream: v1`).

| Method | Path | Who | Returns |
|---|---|---|---|
| POST | `/chat` | any user | body `{id: thread_id, messages: [UIMessage]}` (only the last user message is used; history comes from the LangGraph checkpointer keyed by `thread_id` + user). Streams parts: `start`; `data-status` `{stage: "guard"\|"cache"\|"route"\|"rewrite"\|"retrieve"\|"rerank"\|"grade"\|"retry"\|"answer"}` (transient); `text-start`/`text-delta`/`text-end` for the answer; `data-sources` `{sources: [{n, chunk_id, document_id, title, doc_no, page, section, text, superseded}]}` (only the sources actually cited); `data-meta` `{route: "smalltalk"\|"offtopic"\|"blocked"\|"rag", abstained: bool, cached: bool, rewritten_query?: str, language: "en"\|"hi", message_id, trace_id?}`; `finish`. |
| GET | `/chats` | any user | the user's threads `[{id, title, updated_at}]`, newest first |
| GET | `/chats/{id}` | owner of the thread | `{id, title, messages: [UIMessage]}` (with sources + meta as data parts) |
| DELETE | `/chats/{id}` | owner | `204` |
| POST | `/feedback` | any user | `{message_id, value: "up"\|"down", comment?: str}` → `204` (stored for Insights) |
| GET | `/me/suggested` | any user | `{questions: [str]}` — the user's suggested questions (from demo_corpus/orgs/<org>.json) |
| POST | `/documents/request` | any user | `{question: str, note?: str}` → `204` ("Request a document" from a not-found answer; shown to admins/managers in Insights) |

**Answer rules:** answer only from the cited passages; every claim has `[n]`; markers that don't map to a passage are removed and logged; when retrieval is too weak after one retry, the answer is exactly "Not found in your documents." plus a one-line reason, and no answer-model call is made. Answers are in the question's language (English, Hindi, Hinglish).
