# Atlas v2 — Decisions, problems and open questions

Why Atlas is built the way it is: every real choice, the problem behind it, what we gave up,
and when to look at it again. Git shows *what* changed; this file shows *why*.

**Rules**
- Any change that involves a choice adds or updates an entry **in the same commit**.
- Never delete an entry. When a decision changes, set the old one to `replaced by D-0xx` and add a new one.
- Status: `active` · `active, review` (works, but we plan to look again) · `replaced` · `rejected`.
- Numbers come from measurements (eval files, LangSmith traces, logs), not guesses. Say where.

**Sections:** [1. Open questions](#1-open-questions) · [2. Decisions](#2-decisions) ·
[3. Problems we hit](#3-problems-we-hit-and-how-we-fixed-them) · [4. Options we rejected](#4-options-we-rejected)

---

## 1. Open questions

Decisions the owner still has to make. Each links to the decision it would change.

| # | Question | Now | Options | Notes |
|---|---|---|---|---|
| Q1 | Relevance check time limit: 4 s or 6 s? | 4 s ([D-031](#d-031)) | 4 s · 6 s · 8 s | Owner: keep 4 s for now, **ask again when back**. Main session recommends 6 s with free models. |
| Q2 | Answer model "thinking": on or off? | off ([D-032](#d-032)) | off · on · on only for staff | Owner unsure. Off = same answers in tests, ~2 s instead of ~15 s. |
| Q3 | Free models or paid (Claude Haiku 5.5)? | free ([D-012](#d-012)) | A all free · B paid for small steps only · C paid for Pro customers | Owner: free for now. Recommended: free demo, Haiku for Pro, after the 187-question exam on Haiku. |
| Q4 | Does the answer cache match too loosely? | similarity threshold as shipped ([D-033](#d-033)) | keep · tighten | A longer "step by step" question got the shorter question's cached answer. |
| Q5 | Treat an answer with no citations as "Not found"? | no | yes · no | Cheap way to get the formal Not found back when the 4 s limit hits. |
| Q6 | Browser (Playwright) tests in CI? | run by hand only | add to CI | Planned in Phase 7, never added to CI. |

---

## 2. Decisions

### Product and scope

#### D-001 · Rebuild Atlas from scratch (v2), not refactor v1
`2026-11-22 · active`
- **Problem:** the old Atlas worked but used its own pipeline, and interviewers ask about LangChain, LangGraph, LlamaIndex and LangSmith.
- **Decision:** new repo `atlasV2`. Brought over only the 171 demo documents, the 122 eval questions, and the landing and login designs. No old backend or dashboard code.
- **Why:** a cleaner product plus real experience with the industry frameworks.
- **Trade-off:** more build time. Old features had to be re-earned against the old scores.
- **Bar:** must reach the old Atlas score (Hit@5 ≥ 0.97, 0 leaks) before replacing p1. Reached in [D-020](#d-020).

#### D-002 · Two products in one: staff Atlas + website chat
`2026-11-21 · active`
- **Decision:** internal, permission-aware answers for staff, plus a chat bubble that answers website visitors from **public** documents only.
- **Why:** the same engine and permission check serve both, and the website bubble is what small companies pay for.

#### D-003 · Roles = what you can do, departments = what you can see
`2026-11-22 · active`
- **Decision:** Super admin (owner only) → Admin → Manager → Member → Guest. A website visitor is a built-in role. Admins create departments.
- **Why:** this is simple to explain, and it maps straight onto one filter in the search query ([D-021](#d-021)).
- **Detail:** a manager's scope is their own departments minus the shared "Managers" department.

#### D-004 · Plans: Free = demo only, own company = Pro ₹1,499/month
`2026-11-21 · active`
- **Problem:** free companies would burn the AI question budget.
- **Decision:** Free is the demo only (100 answers/month). Own company and website chat are Pro. Enterprise is "Let's talk". Hard stop at the limits.
- **Payments:** waitlist first, then PayU after 100+ Pro sign-ups. Not built yet.

#### D-005 · Three fictional Indian demo companies
`2026-11-22 · active`
- **Decision:** Nimbus Infotech (IT), Sanjeevani Pharma, Kaveri Capital (finance): 199 documents with an `access:` field, 187 eval questions.
- **Rule:** public documents are visible to Everyone. Nightly reset at 03:00 IST plus a Reset button.

### Architecture and stack

#### D-010 · The core frameworks: LlamaIndex, LangGraph, LangChain, LangSmith
`2026-11-22 · active`
- **Decision:** LlamaIndex handles data (read, split, embed, store, retrieve). LangGraph handles the answer flow (guard, route, retry, memory). LangChain handles model calls and structured output. LangSmith handles traces.
- **Interview line:** *"LlamaIndex is my data layer, LangGraph is my agent workflow, LangChain is my model layer, LangSmith is my observability."*

#### D-011 · Postgres + pgvector for everything (no separate vector DB)
`2026-11-22 · active`
- **Why:** documents, vectors, keyword search and **permissions in one SQL query**, so a forbidden passage can never be returned. One database to back up.
- **Revisit if:** many millions of chunks (then Qdrant).

#### D-012 · Free AI models through our own LiteLLM gateway
`2026-11-22 · active, review (Q3)`
- **Decision:** NVIDIA NIM first, with Groq and Cloudflare as backups. Atlas uses model "slots" (`fast`, `smart`), not model names.
- **Why:** ₹0 cost, and we can change models without changing code.
- **Trade-off:** slow and unpredictable at times, with per-minute and daily quotas (Cloudflare is often out of daily quota). This caused [P-010](#p-010).
- **Revisit:** see Q3.

#### D-013 · Docling for parsing, local embeddings and reranker
`2026-11-22 · active`
- **Decision:** Docling via the LlamaIndex reader (keeps tables), bge-small embeddings, and a local cross-encoder reranker (FastEmbed).
- **Why:** documents never leave our server, and there are no rate limits.
- **Cost:** PDFs take 26–52 s each to ingest, and the api image is about 6.8 GB.

#### D-014 · Celery + Redis for background jobs
`2026-11-22 · active`
- **Why:** Redis was already needed for the cache, rate limits and memory. Tasks are idempotent.

#### D-015 · Clerk for login; our own tables for permissions
`2026-11-21 · active`
- **Decision:** Clerk handles sign-in (Google and email), the waitlist and invites. Roles and departments stay in Postgres.
- **Why:** authentication is hard to do well, but authorization is our product.
- **Detail:** Clerk is in waitlist mode. The demo cookie is only trusted for demo companies.

#### D-016 · Owner (super admin) login through Clerk, password login as hidden backup
`2026-11-23 · active`
- **Decision:** a verified Clerk email in `ATLAS_SUPERADMIN_CLERK_EMAILS` gets the owner cookie. The old email + password login stays at `/login?owner=1`, not linked anywhere.
- **Why:** the owner asked for a single sign-in. The backup covers a Clerk or Google outage.

#### D-017 · PostHog through our own tiny script
`2026-11-22 · active`
- **Decision:** `/analytics.js` sends a few named events to the capture API. No autocapture, recording or cookies, and nothing on the embed.
- **Why:** privacy and a small page weight. US project (signed up on the US site; EU would need a new sign-up).

#### D-018 · Hosting: Docker Compose + Caddy on the VPS, Helm chart as proof
`2026-11-22 · active`
- **Decision:** the live site runs on Compose. The Helm chart is tested on kind in CI to show it's Kubernetes-ready.
- **Address:** p10 first, then moved to **p1.kanav.space** on 2026-11-23; p10 redirects there.

#### D-019 · Monitoring: Prometheus + Grafana, tracing: LangSmith
`2026-11-22 · active`
- **Decision:** Grafana at `/grafana` with 13 panels and 5 alerts, kept behind a password after launch.

### Retrieval and answer quality

#### D-020 · Hybrid search + RRF + jina reranker on the top 10
`2026-11-22 · active`
- **Decision:** vector + keyword search fused with RRF, then `jina-reranker-v1-turbo-en` re-orders the fused top 10 (later 15), and superseded documents are ranked down.
- **Numbers** (`evals/results/20261122T132819Z-retrieval.json`, 167 q): hybrid_rerank **Hit@5 0.988, MRR 0.926, recall 0.982, 0 leaks**, p50 1.7 s.
- **Rejected:** MiniLM-L-6 (lower), MiniLM-L-12 (2× slower), bge-reranker-v2-m3 (1.3 GB, about 12 s per question), 256-token truncation (recall drops). See section 4.

#### D-021 · Permissions are enforced inside the search query
`2026-11-22 · active`
- **Decision:** every chunk carries its company, departments and public flag, and the database filter runs **before** ranking.
- **Why:** the AI never sees text the person can't read. 0 leaks in every eval run.

#### D-022 · Router answers "Hi" without searching
`2026-11-22 · active`
- **Problem:** in the old Atlas, "Hi" ran a full search and rerank.
- **Decision:** instant rules for greetings and thanks, then the `fast` model sorts everything else (small talk, off-topic, blocked, document question).

#### D-023 · Relevance grade as a gate, not a filter
`2026-11-22 · active`
- **Problem:** answers built from unrelated passages, for example an L4 salary question answered from a referral-bonus table.
- **Decision:** reranker score threshold `grade_threshold = -1.1` (jina scale), plus an LLM check of "do these passages answer it?". If not, retry once, then "Not found".
- **Tried first:** using the LLM to filter out passages. It kept only 1–3 of 5 and produced 11 partial answers, so it was changed to a gate.
- **Numbers:** calibration accuracy 0.968 (0.878 without the LLM check). Answer exam: 89.2% fully correct, 98.8% correct or partial, 0 leaks.

#### D-024 · Answer exam graded blind by Claude, not RAGAS on free models
`2026-11-22 · active, review`
- **Problem:** RAGAS with free models was too slow and starved live users, because all three providers hit their rate limits at once.
- **Decision:** answers were graded blind by Claude against a rubric. CI runs only a small retrieval and leak gate.
- **Revisit:** RAGAS in CI once a paid judge model exists.

### Speed (2026-11-23)

Measured cause (LangSmith, last 100 questions): relevance check median 3.4 s but **p90 17.1 s** (over 8 s in 21 of 99); answer p90 12.3 s. Example: "where is nimbus at" took 26.5 s, of which the relevance check was 16.2 s.

#### D-030 · Relevance check runs in parallel with the answer
`2026-11-23 · active`
- **Decision:** after search, the answer starts writing into a buffer while the relevance check runs. On "yes" (or a timeout with a good score) the buffer is released. On "no" it is cancelled and the Not found / retry path runs.
- **Why:** total time becomes about max(check, answer) instead of check + answer.
- **Cost:** answer tokens are thrown away on questions that end in Not found.
- **Where:** `graph.py` grade_node / answer_node.

#### D-031 · Time limits: route 3 s, rewrite 3 s, relevance check 4 s
`2026-11-23 · active, review (Q1)`
- **Decision:** when a limit is hit:
  - route: treat the message as a document question;
  - rewrite: search with the original words;
  - relevance check: decide by the search score alone.
  Every timeout is logged and added to the trace.
- **Why:** a user waiting 16+ seconds is worse than a slightly less careful check. It fails safe, because permissions are enforced in the search, not in this step.
- **Trade-off:** in the 20-question spot check the 4 s limit hit 10 times. 5 of 10 "should refuse" questions got "the documents do not state…" instead of the formal Not found (no wrong facts, 0 leaks).
- **Opinion for:** time budgets per step are standard in production AI systems.
- **Opinion against:** a fixed number is a guess, and with slow free models it hides a slow model rather than catching a rare hiccup.
- **Revisit if:** we move to a paid model, or timeouts exceed about 10% of questions.
- **Owner (2026-11-23):** keep 4 s for now and ask again.

#### D-032 · Answer model "thinking" switched off
`2026-11-23 · active, review (Q2)`
- **Decision:** `ATLAS_ANSWER_THINKING=false` in `infra/.env` (the code default is still true).
- **Why:** one answer spent 12 s reasoning before the first word. Off gives the same answers in about 2 s instead of 15 s, and 10/10 answerable questions were correct afterwards.
- **Owner:** unsure, so kept off for now.

#### D-033 · Redis 8 + semantic answer cache on
`2026-11-23 · active, review (Q4)`
- **Decision:** `redis:8-alpine` on the named volume `atlasv2_redis` (a dump is backed up). The cache is scoped by company + role + departments + language, and visitors have their own scope.
- **Invalidation:** a counter per company is bumped on ingest, delete, public toggle, department rename and demo reset. Entries expire after 24 h.
- **Numbers:** repeat questions are answered in 0.3–1.6 s.

#### D-034 · Atlas-only gateway model groups
`2026-11-23 · active`
- **Problem:** the shared `fast` group waited 8 s and then retried the same slow NIM model for another 8 s.
- **Decision:** `atlas-fast` (Groq → NIM 4 s → Cloudflare) and `atlas-smart` (NIM with an 8 s first-word limit → Groq → Cloudflare), with no retry on the same provider. Other apps keep the old groups.
- **Why Groq first:** with NIM first, the relevance check timed out on 11 of 20 questions.
- **Backup:** `~/deploy/ai-gateway/config.yaml.bak-2026-11-23-atlas`.

#### D-035 · Empty answers never reach the user
`2026-11-23 · active`
- **Problem:** see [P-011](#p-011).
- **Decision:** the visitor token cap went from 400 to 1500. An empty or citation-only answer is retried once on the fallback models, then the user gets "please try again" (marked abstained, never cached). The bubble also shows "No answer came. Try again." + Retry after 60 s with no progress.
- **Check:** 0 empty answers in 39 live answers.

### Website, UI and brand

#### D-040 · One-line snippet + iframe widget for website chat
`2026-11-22 · active`
- **Decision:** `widget.js` draws the bubble and loads `/embed/<key>` in an iframe.
- **Protections:** allowed origins (CSP frame-ancestors per key), rate limits (10/min and 100/day per IP, 1,000/day per company), a honeypot field, and a 500-character limit.

#### D-041 · Login page: sign-in first, demo as folder tabs
`2026-11-23 · active`
- **Decision:**
  - A big "Sign in with Google or email" button at the top.
  - The demo below it: "1 Choose a company" tabs, and the selected tab joins a panel in the company's colour, "2 Log in as someone at …".
  - People are shown in a grid grouped by role.
- **Why:** the owner found the vertical list hard to scan, and it wasn't clear which people belonged to which company.

#### D-045 · While invite-only, "Join the waitlist" is the main action, "Sign in" is second
`2026-11-23 · active (swap back when sign-ups open)`
- **Problem:** Clerk is in waitlist mode, but the login page's biggest button was "Sign in with Google". Visitors clicked it, got "sign-ups unavailable", and Clerk's "Join waitlist" link was small text at the bottom.
- **Decision:**
  - `/login`: an "Atlas is invite-only for now" box with a big **Join the waitlist** button, then a smaller "Already invited? Sign in with Google or email".
  - `/sign-in` and `/sign-up`: the same note above the Clerk box.
  - (Our own email form was used here at first; replaced the same day by Clerk's own waitlist, see [D-046](#d-046).)
  - The demo is unchanged.
- **Layout (same day):** on laptop the access box sits in a left column and the demo in a right column, so the whole page fits one screen; on phones they stack.
- **Gotcha:** links INTO Clerk pages (`/waitlist`, `/sign-in`) must be plain `<a>` (full page load). With Next's client-side `<Link>`, Clerk's box didn't appear (seen: sign-in → note link → empty waitlist).
- **Revisit when:** sign-ups open (PayU or 100+ waitlist). Then Clerk goes back to open mode and "Sign in" becomes the main button again. Where: `app/login/page.tsx` `SignInButton`, `components/waitlist-form.tsx`.

#### D-046 · One waitlist: Clerk's own `<Waitlist />`, hosted on our site
`2026-11-23 · active`
- **Problem:** two waitlist forms (ours and Clerk's) felt repetitive, and Clerk's "Join waitlist" link sent visitors off-site to `accounts.kanav.space/waitlist`, whose home link pointed at the portfolio.
- **Decision:** a new page `/waitlist` renders Clerk's `<Waitlist />` component. `ClerkProvider waitlistUrl="/waitlist"` makes Clerk's own link go there. The login button and the landing page's "Join the Pro waitlist" both link to it. Our custom form component was deleted.
- **Both paths land in the same Clerk waitlist** (Clerk dashboard + Owner area → Waitlist).
- **Trade-off:** PostHog now sees the click (`waitlist_click`), not the join itself. `POST /api/public/waitlist` is left in the API but unused by the web.

#### D-042 · Atlas logo = the owner's "A", traced to SVG
`2026-11-23 · active`
- **Decision:** the PNG's transparent edge was traced with potrace (99.8% shape overlap).
  - `atlas-logo.svg`: blurred colour field, colour difference 0.75 out of 255, for large sizes.
  - `atlas-mark.svg`: single gradient, 7 KB, for small sizes.
  - Used for the favicon, sidebar, login and landing page.

#### D-043 · Demo company logos and websites: drawn illustrations only
`2026-11-23 · active`
- **Decision:** own SVG logos (cloud + code, leaf + cross, bars + river). Each demo website gets its own design file, with drawn illustrations and no photos (owner's choice).
- **Rule:** facts on the sites come only from each company's **public** documents, so the site never contradicts the chat bubble.
- **Built 2026-11-23:** layout ideas from real sites in each industry (Nimbus: Datadog, Thoughtworks, Better Stack · Sanjeevani: Lupin, Teva, Viatris · Kaveri: PPFAS, Mirae Asset, T. Rowe Price); no text, logos or graphics copied. Nimbus shows no prices, phone numbers or client names because its public docs have none.

#### D-044 · Bubble colours follow each company's brand, with AA contrast
`2026-11-23 · active`
- **Decision:** Nimbus `#1976D2` (not `#1E88E5`, because white on it is only 3.68:1), Sanjeevani `#00796B`, Kaveri `#1A237E`. Stored in `demo_corpus/orgs/*.json` so the demo reset keeps them.

### Operations

#### D-050 · Keep the Docker build cache, prune only images
`2026-11-22 · active`
- **Problem:** see [P-001](#p-001).
- **Rule:** never `docker builder prune` after builds (it rebuilds the 6.8 GB dependency layer). Run `docker image prune -f` instead, and check `df -h /` before long builds.

#### D-051 · Nothing scheduled nightly except the demo reset
`2026-11-22 · active`
- **Why:** nightly evals on free models starved live users. Evals are run by hand.

#### D-052 · One deploy at a time
`2026-11-23 · active`
- **Rule:** parallel helpers deploy through `flock /tmp/atlasv2-deploy.lock`.

---

## 3. Problems we hit and how we fixed them

| # | Problem | Cause | Fix |
|---|---|---|---|
| <a id="p-001"></a>P-001 | Disk full (3 times) | 6.8 GB api image + build cache + eval containers holding old images | Keep the build cache, `docker image prune -f`, no rebuilds while evals run ([D-050](#d-050)) |
| P-002 | MCP returned 401 on the public URL | Caddy's basic auth swallowed the `Authorization: Bearer` header | Exempted `/api/mcp`, `/api/public/*`, `/widget.js`, `/embed/*` from the password and gate |
| P-003 | "Hi" ran a full search | No router in the old flow | Rules + `fast` router ([D-022](#d-022)) |
| P-004 | Wrong answers from unrelated passages; false "not found" for "leave types" | Score threshold alone isn't enough | LLM relevance gate + recalibration ([D-023](#d-023)) |
| P-005 | Retrieval recall looked like 0.877 | Eval text matching bug (HTML entities, dash types) | Fixed the matching; real recall 0.928 → 0.982 with the reranker |
| P-006 | Streaming answers arrived all at once | Next.js gzip buffered the stream | Stream excluded from compression |
| P-007 | Citations lost on some fallback answers | gpt-oss writes `【n】` instead of `[n]` | `citations.py` reads both |
| P-008 | Caddy stopped after a config edit | `sed -i` replaces the file, breaking the single-file bind mount | Edit the Caddyfile in place (never `sed -i`) |
| P-009 | Free models all returned 429 during evals | RAGAS judge + live users on the same free quotas | Stopped RAGAS exams; Claude blind grading ([D-024](#d-024)) |
| <a id="p-010"></a>P-010 | Website answers took 9–42 s | Slow free model + gateway retry (8+8 s) on the relevance check; answer model "thinking" | [D-030](#d-030)–[D-034](#d-034): now about 3–14 s, repeats under 2 s |
| <a id="p-011"></a>P-011 | Visitor sometimes got no answer and no error | 400-token visitor cap used up by the model's reasoning → empty reply, still sent as "finished" | [D-035](#d-035) |
| P-012 | Redis came up empty after the upgrade | `redis:8` image declares no data volume | Named volume `atlasv2_redis`, seeded from the old one |
| P-013 | Owner redirect pointed at `0.0.0.0:3000` | Request URL inside the container is internal | Redirects use the public origin constant |
| P-014 | Aegis (p4) Atlas tool broke | It pointed at the old Atlas, which was shut down | Left alone on owner's order (Atlas is its own project) |
| P-015 | Test waitlist entry couldn't be deleted | Clerk API can't delete an already-rejected entry | Left as rejected (harmless) |

---

## 4. Options we rejected

| Option | Why not |
|---|---|
| Refactor the old Atlas | Wanted the industry frameworks and a clean design ([D-001](#d-001)) |
| Pinecone / Qdrant / Weaviate | Permissions + vectors in one Postgres query ([D-011](#d-011)) |
| LlamaParse / Unstructured cloud | Paid, and documents would leave the server |
| CrewAI / AutoGen | Atlas is one fixed flow, not a team of agents |
| Haystack · DeepEval · OpenFGA · RabbitMQ | Duplicates or overkill for our size |
| Langfuse | Owner chose LangSmith |
| Supabase · Arcjet | Own Postgres; own Redis rate limits + injection check |
| Clerk Billing | Stripe only; India needs PayU |
| MiniLM-L-12 / bge-reranker-v2-m3 reranker | 2× slower / about 12 s per question for no gain |
| Relevance grade as a filter | Dropped good passages → 11 partial answers |
| RAGAS on free models in CI | Too slow; starved live users |
| Pruning the Docker build cache | Rebuilds 6.8 GB each time; filled the disk |
| Stock photos on demo websites | Owner chose drawn illustrations |
| Flaticon icons | Free licence needs a credit line; drew our own |
