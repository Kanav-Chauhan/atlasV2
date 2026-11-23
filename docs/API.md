# Atlas v2 API contract

The web app proxies `/api/*` to the API (`next.config.ts` rewrite), so the browser's cookies reach the API.

## Who is calling (`routes.current_user`, Phase 10)

Two ways in, checked in this order. Every query is then scoped to that person's organization.

1. **Demo login.** The login page sets the httpOnly cookie `atlas_demo_user=<email>` (Next
   URL-encodes it; the API decodes it). It is only a plain email, so the API accepts it **only for
   people at a demo company** (`organizations.plan = 'demo'`, never a person with a Clerk link).
   Naming anyone at a real company with it → `401`.
2. **Real users: a Clerk session** (`clerk.py`). The Clerk session JWT reaches the API as
   - the `__session` cookie: clerk-js sets it on p10.kanav.space (same site), and the browser's
     `/api/*` calls carry it through the Next rewrite; `lib/api.ts` asks clerk-js for a fresh one
     and retries once on a `401` (the cookie lives ~60 s; clerk-js renews it in the background), or
   - `Authorization: Bearer <jwt>` (any server-side caller; a Bearer that is not a JWT is ignored).
   Next server components call `GET /me` forwarding the request's cookies.

   The API verifies it without a per-request network call: RS256 signature with the instance's
   JWKS (`https://clerk.kanav.space/.well-known/jwks.json`, cached 1 h; the frontend API host comes
   from `ATLAS_CLERK_PUBLISHABLE_KEY`), `iss`, `exp`/`nbf`/`iat` (5 s leeway), `azp` must be
   `ATLAS_APP_ORIGIN` (https://p10.kanav.space) and `sub` a Clerk user id. Then
   `users.clerk_user_id = sub`. The first time a Clerk user is seen, the API looks them up in the
   Clerk Backend API and links them to an existing, unlinked person **at a non-demo company** whose
   email equals Clerk's **verified primary email** (invited people). Nobody → `401` from normal
   routes and the web sends them to `/onboarding`.

No cookie/token, an invalid token, or no person → `401 "Please log in."`.
Super admin is separate (`atlas_super` cookie, below).

| Method | Path | Who | Returns |
|---|---|---|---|
| GET | `/me` | anyone logged in | `{email, name, title, role, departments, org: {slug, name}, plan, auth: "demo" \| "clerk"}` |
| GET | `/onboarding` | valid Clerk session | `{linked, email, name, org}`: `linked: true` (+ `org` slug) when the person exists or was just linked by email; else `email`/`name` from Clerk. `403` without a verified email, `401` without a valid session |
| POST | `/onboarding` | valid Clerk session | `{company (2–200), industry?}` → creates the organization (plan `pro` until payments) and the caller as its `admin` → `{linked: true, email, name, org}`. Idempotent: if the caller already has (or can be linked to) a person, nothing is created and that person's org is returned; a double submit keeps one company. `409` if the email belongs to a demo person or another Clerk login |

**Invitations.** `POST /team` on a real company also sends a Clerk invitation
(`/v1/invitations`, redirect `https://p10.kanav.space/sign-up`, works while sign-up is
waitlist-only); the response adds `invite: "sent" | "exists" | "failed" | null` (`null` = demo
company, nothing sent). The person signs up with that email and links on first sign-in.

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
| POST | `/chat` | any user | body `{id: thread_id, messages: [UIMessage]}` (only the last user message is used; history comes from the LangGraph checkpointer keyed by `thread_id` + user). Streams parts: `start`; `data-status` `{stage: "guard"\|"cache"\|"route"\|"rewrite"\|"retrieve"\|"rerank"\|"grade"\|"retry"\|"answer"}` (transient); `text-start`/`text-delta`/`text-end` for the answer; `data-sources` `{sources: [{n, chunk_id, document_id, title, doc_no, page, section, text, superseded}]}` (only the sources actually cited); `data-meta` `{route: "smalltalk"\|"offtopic"\|"blocked"\|"rag", abstained: bool, cached: bool, rewritten_query?: str, language: "en"\|"hi", message_id, relevance?: "yes"\|"partial"\|"no"\|"skipped"\|"off"\|"error", trace_id?, trace_url?}` (`relevance` = the Phase 6 LLM relevance grade of the last search; `trace_id`/`trace_url` = the LangSmith trace, only when tracing is on); `finish`. |
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
| GET | `/org/plan` | admin | `{plan, questions_month, questions_used, documents, documents_used, people, people_used}` (limits `null` = none) |
| POST | `/demo/reset` | admin of a demo company | `202 {status: "queued"}`; 403 other companies; 429 within 5 min of the last reset |

### Super admin (the Atlas owner, not a company)

Login is a separate option on the login page: email `sa@kanav.space` + password, checked against `ATLAS_SUPERADMIN_EMAIL` / `ATLAS_SUPERADMIN_PASSWORD_HASH` (argon2) in env. Success sets an httpOnly, signed cookie `atlas_super` (8 h); rate-limit 5 attempts/min per IP.

| Method | Path | Returns |
|---|---|---|
| POST | `/auth/super` | `{email, password}` → `204` + cookie, or `401` |
| POST | `/auth/super/logout` | `204` |
| GET | `/super/orgs` | `[{slug, name, people, documents, chunks, questions_30d, not_found_pct_30d, last_activity}]` (`not_found_pct_30d` 0–100 or `null`; `last_activity` timestamp or `null`) |
| GET | `/super/evals` | all eval runs, newest first. Retrieval runs: `{kind: "retrieval", run_id, created_at, modes: {<mode>: {hit_at_1, hit_at_3, hit_at_5, mrr, context_recall, leaks, n}}}` (same item shape as `/evals/latest`). Answer runs (Phase 6, `scripts/eval_answers.py`): `{kind: "answers", run_id, created_at, summary: {runs, errors, answerable, negatives, correct_answer, correct_or_partial, false_not_found, correct_not_found, declined_in_words, leaks, latency_p50_ms, latency_p95_ms, relevance: {verdict: count}, ragas: {faithfulness, answer_relevancy, context_precision, context_recall, n}, by_org: {<slug>: {correct_answer, false_not_found, correct_not_found, leaks, n}}, config: {threshold, relevance_grade, judge, questions, org, ragas}, seconds}}`; rates are 0–1 or `null` |
| GET | `/super/usage?days=30` | `[{org (slug), model, questions, tokens_in, tokens_out, avg_latency_ms}]` per org and model; `model` is the gateway slot (`smart` for document answers, `none` otherwise) until Phase 6 logs it; tokens `null` until then |
| GET | `/super/waitlist` | `[{id, email, status, created_at (ms)}]` from Clerk Waitlist, newest 100; `[]` without a Clerk key; 502 if Clerk fails |
| POST | `/super/waitlist/{id}/invite` | `204`: Clerk invites that entry (email with a sign-up link); `404` unknown entry, `502` Clerk failed, `503` no Clerk key |
| POST | `/public/waitlist` | `{email, website?}` (honeypot) → 204, added to Clerk Waitlist (repeat = same entry); 422 bad email, 429 after 5/hour/IP, 503 without a Clerk key. No login; Caddy-exempt like /public/* |
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
| GET | `/public/{site_key}/config` | `{company, greeting, accent, position, show_badge, allowed_origins: [str]}` (`allowed_origins` always includes p10; the web app turns it into `Content-Security-Policy: frame-ancestors` on `/embed/<key>`, cached 60 s); `404` if unknown/disabled, `403` if the caller's Origin/Referer is not allowed |
| POST | `/public/{site_key}/chat` | same body and **AI SDK UI message stream** as `/chat`, answered as the website visitor; `thread_id` comes from the client (random, kept in the iframe's sessionStorage); history kept 24 h. Guards: rate limit per IP (10/min, 100/day; IP = the **last** `X-Forwarded-For` hop, the one Caddy wrote) and per site key (1,000/day), question ≤ 500 chars, honeypot field `website` must be empty, prompt-injection guard, answer token cap. |

## Endpoints (Phase 9: MCP server)

Atlas is an **MCP server** (Model Context Protocol, Streamable HTTP) mounted in FastAPI at `/mcp`. An AI agent
(Claude Desktop, Claude Code, Cursor…) connects with a **service token** that is bound to one person: the agent
sees exactly what that person can see (same `access.py` filters). Every tool call is audit-logged.

### Tokens (admin; cookie auth)

| Method | Path | Returns |
|---|---|---|
| GET | `/tokens` | `[{id, name, user: {id, name, email}, created_at, last_used_at, revoked}]` (never the secret) |
| POST | `/tokens` | `{name, user_id}` → `{id, name, token}` — the secret `atl_…` is shown **once**; only a hash is stored |
| DELETE | `/tokens/{id}` | revoke → `204` |
| GET | `/tokens/audit?days=7` | `[{at, token_name, user_email, tool, args_summary, ok, latency_ms}]` |

### MCP tools (`Authorization: Bearer atl_…`)

| Tool | Input | Output |
|---|---|---|
| `search_knowledge` | `{query, top_k?: 5}` | passages `[{title, doc_no, department, page, section, text, document_id, score}]`; `abstained: true` when nothing is good enough |
| `ask_question` | `{question}` | `{answer, sources: [{n, title, doc_no, page, section, document_id}], abstained}` — the full LangGraph answer flow as that person, one fresh turn (no history, semantic cache on); `[n]` in the answer = `sources[].n` |
| `get_document` | `{document_id}` | `{title, doc_no, department, text}` (Markdown, truncated to a safe length) or a not-found error |
| `list_departments` | `{}` | departments the bound person can read, with document counts |

Unknown tool → JSON-RPC error; invalid/revoked token → `401`; per-token rate limit.

## Plans and limits (Phase 10, `plans.py`)

| Plan | Questions | Documents | People |
|---|---|---|---|
| `demo` (the 3 demo companies) | 40 a day per visitor (IP) on Ask | 230 | 40 |
| `pro` | 5,000 a month per company (Ask + website chat + MCP `ask_question`) | 200 | 25 |
| `enterprise` | no limit | no limit | no limit |

Over a question limit → `429 {detail}` with a plain reason (MCP: a tool error with the same text). Over the document or people cap → `403 {detail}`. Monthly counts are in Redis (`plan:q:<org_id>:<YYYYMM>`) and start again on the 1st (UTC).
