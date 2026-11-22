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

## Endpoints (Phase 7: dashboard)

Roles: **admin** = whole company; **manager** = own departments (can add/remove members and guests in them); members and guests see none of these.

**Manager scope** (`access.team_scope`): a manager's departments **minus the shared `Managers` department**. Every manager is in `Managers` (for manager-only documents), so counting it would let the HR manager manage every manager; the `Managers` department and its people are admin-managed. This scope drives `/team`, `/access` columns, `/insights` and who a manager may add/change/remove.

Ids are integers. Dates are ISO strings (`guest_until` `YYYY-MM-DD`, timestamps ISO 8601 with offset). Percentages are **0–100** with one decimal, or `null` when there is nothing to divide by.

| Method | Path | Who | Returns |
|---|---|---|---|
| GET | `/team` | admin, manager | `[{id, name, email, title, role, departments, guest_until, last_active}]` (manager: people in their departments) |
| POST | `/team` | admin; manager (role member/guest, only own departments) | `{name, email, title, role, departments, guest_until?}` → the person (`409` if the email exists) |
| PATCH | `/team/{id}` | same rules | any of `{title, role, departments, guest_until}` → the person. Nobody can change their own role; the last admin can't be demoted. |
| DELETE | `/team/{id}` | same rules | `204` (not yourself, not the last admin) |
| POST | `/departments` | admin | `{name, description}` → department (`409` duplicate) |
| PATCH / DELETE | `/departments/{name}` | admin | rename/describe; delete only when no documents and no people |
| GET | `/access` | admin, manager | who can read what: `{departments: [str], people: [{id, name, role, can_read: {<department>: bool}, everyone: true}]}` (manager: only departments in their scope as columns; admin rows are all `true`) |
| GET | `/insights?days=30` | admin (company), manager (people in their scope) | `{questions, answered, not_found, blocked, smalltalk, answered_pct, avg_latency_ms, p95_latency_ms, feedback: {up, down}, top_unanswered: [{question, count}], document_requests: [{question, note, by, created_at}], top_documents: [{document_id, title, citations}], by_department: [{department, questions}], per_day: [{date, questions, not_found}]}` — computed from stored chat messages. `days` 1–365. `questions` counts every assistant turn; `answered_pct` = answered / document questions (route `rag`), 0–100 or `null`; latencies (ms) over `rag` turns, `null` when none; `per_day` has exactly `days` entries, oldest first, `date` = `YYYY-MM-DD` (UTC), zero-filled; top lists ≤ 10, `document_requests` ≤ 50 newest first, `note` may be `null` |
| GET | `/documents/review` | admin, manager | documents needing review: past their `review` date or effective > 12 months ago, in scope: `[{id, title, access, effective, review, reason}]` |
| GET / PATCH | `/org` | GET admin, PATCH admin | `{slug, name, industry, description}` |

### Super admin (the Atlas owner, not a company)

Login is a separate option on the login page: email `sa@kanav.space` + password, checked against `ATLAS_SUPERADMIN_EMAIL` / `ATLAS_SUPERADMIN_PASSWORD_HASH` (argon2) in env. Success sets an httpOnly, signed cookie `atlas_super` (8 h); rate-limit 5 attempts/min per IP.

| Method | Path | Returns |
|---|---|---|
| POST | `/auth/super` | `{email, password}` → `204` + cookie, or `401` |
| POST | `/auth/super/logout` | `204` |
| GET | `/super/orgs` | `[{slug, name, people, documents, chunks, questions_30d, not_found_pct_30d, last_activity}]` (`not_found_pct_30d` 0–100 or `null`; `last_activity` timestamp or `null`) |
| GET | `/super/evals` | all retrieval eval runs, newest first: `[{run_id, created_at, modes: {<mode>: {hit_at_1, hit_at_3, hit_at_5, mrr, context_recall, leaks, n}}}]` (same item shape as `/evals/latest`) |
| GET | `/super/usage?days=30` | `[{org (slug), model, questions, tokens_in, tokens_out, avg_latency_ms}]` per org and model; `model` is the gateway slot (`smart` for document answers, `none` otherwise) until Phase 6 logs it; tokens `null` until then |
| GET | `/super/waitlist` | `[{email, created_at}]`; `[]` until Clerk (Phase 10) |
| GET | `/super/orgs/{slug}/view` | read-only snapshot: `{org: {slug, name, industry, description}, team: [person as in /team], documents: [document as in /documents, newest first], insights: (as /insights?days=30, whole company)}`; `404` unknown slug |

## Endpoints (Phase 8: website chat)

A company marks documents **public** and pastes one line on its website:
`<script src="https://p10.kanav.space/widget.js" data-atlas-key="<site_key>" async></script>`.
The bubble opens an iframe `/embed/<site_key>` that talks to the public API. A website visitor is a built-in
principal that can read **only `is_public` documents of that company** (filter built in `access.py`, same
retrieval as staff). No staff document, chat history or name is ever reachable from public routes.

### Admin (cookie auth, admin only)

| Method | Path | Returns |
|---|---|---|
| GET | `/website-chat` | `{enabled, site_key, allowed_origins: [str], greeting, accent, position: "right"|"left", show_badge, public_documents}` |
| PATCH | `/website-chat` | any of `{enabled, allowed_origins, greeting, accent, position}` (`show_badge` stays true until Pro) |
| POST | `/website-chat/rotate-key` | new `site_key` (old one stops working) |
| PATCH | `/documents/{id}` | `{is_public: bool}` (admin) → the document |
| GET | `/website-chat/conversations?days=30` | `[{id, started_at, origin, messages, last_question, not_found}]`, and `GET /website-chat/conversations/{id}` → messages |

### Public (no cookie; CORS/`frame-ancestors` limited to `allowed_origins` + p10 itself)

| Method | Path | Returns |
|---|---|---|
| GET | `/public/{site_key}/config` | `{company, greeting, accent, position, show_badge}`; `404` if unknown/disabled |
| POST | `/public/{site_key}/chat` | same body and **AI SDK UI message stream** as `/chat`, answered as the website visitor; `thread_id` comes from the client (random, kept in the iframe's sessionStorage); history kept 24 h. Guards: rate limit per IP (10/min, 100/day) and per site key (1,000/day), question ≤ 500 chars, honeypot field `website` must be empty, prompt-injection guard, answer token cap. |
