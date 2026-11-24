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
`2026-11-23 · replaced by D-047 (layout); the invite-only wording still applies`
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
`2026-11-23 · active (now inside /login, D-047)`
- **Problem:** two waitlist forms (ours and Clerk's) felt repetitive, and Clerk's "Join waitlist" link sent visitors off-site to `accounts.kanav.space/waitlist`, whose home link pointed at the portfolio.
- **Decision:** a new page `/waitlist` renders Clerk's `<Waitlist />` component. `ClerkProvider waitlistUrl="/waitlist"` makes Clerk's own link go there. The login button and the landing page's "Join the Pro waitlist" both link to it. Our custom form component was deleted.
- **Both paths land in the same Clerk waitlist** (Clerk dashboard + Owner area → Waitlist).
- **Loading:** Clerk's card appears ~1–2 s after our page (its scripts, then settings, then the card's own files, one after another). Not fixable to 0: it's Clerk's loading chain. Web search (2026-11-23): Clerk's official answer is `<ClerkLoading>` with your own placeholder; bundling clerk-js into the app is only a proposal (PR #7779, Next.js still uses the CDN); `prefetchUI` is already on by default.
- **Placeholder style:** first a pale copy of Clerk's card, then (owner's choice) a **YouTube-style skeleton**: grey bars with a light sweep (`.skeleton-bar` in globals.css, still for reduced motion), laid out like Clerk's card and the same size (waitlist 371 vs 372 px, sign-in 457 vs 460 px). Inside `<ClerkLoading>` in `components/clerk-skeleton.tsx`.
- **Not done yet (offered):** pin `clerkJSVersion`/`clerkUIVersion` to skip the `@6` → `@6.46.2` redirect (~0.1–0.2 s; must be bumped on Clerk upgrades); a `<ClerkFailed>` "couldn't load, check ad blocker" message.
- **Trade-off:** PostHog now sees the click (`waitlist_click`), not the join itself. `POST /api/public/waitlist` is left in the API but unused by the web.

#### D-047 · Everything on /login: Join waitlist + Sign in tabs (Clerk's own boxes) and the demo
`2026-11-23 · active (replaces the separate pages of D-045/D-046)`
- **Problem:** waitlist, sign-in and the demo were on three pages, with links and redirects between them. The owner said: one page, no redirect mess.
- **Decision:**
  - `/login` left column (400 px, Clerk's card width): tabs **Join waitlist** (default while invite-only) and **Sign in**, each showing Clerk's real `<Waitlist />` or `<SignIn routing="hash" />`. Right column: the demo.
  - `?tab=` holds the tab, so Clerk's own links (`signInUrl` / `waitlistUrl` = `/login?tab=…`) just switch it.
  - **`/sign-in` and `/waitlist` pages deleted** (404).
  - **`/sign-up` kept:** Clerk invitation emails link to `<origin>/sign-up` (`clerk.py` invite `redirect_url`).
  - `/auth/owner` (the post-sign-in landing) now clears the demo cookie; the old "Sign in" server action is removed.
- **After joining:** Clerk shows "Thanks… You will be redirected soon…" then goes to `afterJoinWaitlistUrl`. It used to point at the same URL, so nothing changed and people looked stuck. Now `/login?tab=waitlist&joined=1`, which swaps Clerk's box for our green "✓ You're on the waitlist" message (switching tabs clears it). Clerk's bot protection blocks headless browsers, so a real join can only be tested by a person.
- **Cost:** Clerk's scripts load on /login (in the background; the demo works at once, and the placeholder card covers the box).
- **Checked live:** both tabs, Clerk's links switching tabs, unknown email → "Couldn't find your account" on /login, demo company switch + demo login, phone 390 px, no sideways scroll at 1024/1440.

#### D-048 · UI design base: one page frame, white cards on a tinted canvas, status colours with words
`2026-11-24 · active`
- **Problem:** owner: everything black-and-white and hard to scan, nothing stands out, should feel premium; page widths differed (Home ~960, Library/Team/Insights ~1088, Settings ~608); headings heavy.
- **Decision:**
  - Tokens `canvas` / `surface` / `rule-soft`, and status colours `success` / `warn` / `error` / `info`, each with `-soft` / `-line` (light + dark, text on soft ≥ 5.4:1).
  - `--shadow-xs/sm/md` and `--page-max` 1152px.
  - One page frame and header on every page: title 28px weight 500, description, action on the right.
  - Sections are white cards with a soft edge. Badges are tinted pills that always say their meaning in words.
  - One inline SVG icon set: `components/ui/icons.tsx`, plus `components/ui/page.tsx` (Page, PageHeader, Card).
- **Why:** research patterns, ideas only:
  - Linear: dimmer sidebar, softer separators.
  - Vercel Geist: two backgrounds, ring + soft shadow, colour only for state.
  - Stripe: spacing scale, badge types, loading → error → empty → content.
  - Refactoring UI: tinted badges.
- **Trade-off:** older pages inherit it through CSS selectors (`.app > main > .mx-auto`), which is implicit. Pages move to `<Page>`/`<PageHeader>` as each phase rewrites them.

#### D-049 · Sidebar grouped into Work / Manage; Lab moved to the Owner area
`2026-11-24 · active`
- **Problem:** 10 ungrouped rail items for an admin; the Retrieval Lab is an owner/interview tool, not a company feature.
- **Decision:**
  - A 232px labelled sidebar:
    - company at the top;
    - **Work**: Home, Ask, Search, Library;
    - **Manage**: Team, Website chat, Insights, Agent access, Settings;
    - you, the theme switch and Log out at the bottom.
  - Group labels only show when a role has both groups. Phones keep the bottom bar.
  - Lab is removed from all company roles. `/app/lab` needs the owner cookie plus an Admin login, and is linked from the `/super` nav.
- **Review:** Search leaves the sidebar when it merges into Ask (Phase 3).

#### D-050 · Home: two options for the owner to pick (A hero ask, B command centre)
`2026-11-24 · active — owner picked B (command centre); A deleted`
- **Problem:** Home sections looked the same, Needs review had no urgency, "This month" repeated Insights, recent chats were duplicated.
- **Decision:**
  - `/app?home=a` (default) and `/app?home=b`, both on the same data.
  - Chats with duplicates removed.
  - Reviews coloured by how overdue: ≥ 90 days red, less amber, over a year old blue.
  - Only numbers you can act on (unanswered questions → Add documents).
  - Members and guests (no insights/review rights) see their documents instead.
- **Owner's pick (2026-11-24):** **B** (command centre). A was deleted. B is the only Home at `/app`.

#### D-051 · One side document viewer; nothing downloads on click
`2026-11-24 · active`
- **Problem:** Search downloaded documents instead of opening them; Library should open documents on the side like the old Atlas.
- **Decision:** one shared viewer (`components/doc-viewer`), used in Ask (docked) and Search/Library (side sheet).
  - Small / Half / Full sizes, full screen on phones, Esc closes, focus trapped and returned.
  - URL keeps `?doc=&page=&chunk=&tab=`, so a refresh or a shared link reopens it.
  - Download is a separate, explicit button.
- **PDFs:** drawn as real pages with pdf.js (`pdfjs-dist` 6.5.438, loaded only when a PDF opens, worker from our own `/_next/static`). The cited passage is highlighted (best effort) and shown word for word in a "Cited passage" strip.
- **Word / Markdown / text:** formatted text from `GET /documents/{id}/text`, with the cited blocks highlighted.
- **"How Atlas reads this" tab:** the chunks (the old Library "Chunks" link); hidden for Guests.
- **API:** `/documents/{id}/file?inline=1` (default is still attachment); `GET /documents/{id:int}`. Same `can_read` check everywhere; visitors still have no file route.
- **Gotcha:** update the URL with `history.replaceState(null, …)`. Passing `history.state` makes Next skip it, and the viewer never opens.

#### D-052 · Team = groups; people get access from their group; built for thousands
`2026-11-24 · active`
- **Problem:** owner: a big company can't list every employee or tick a person × department grid.
- **Decision:**
  - Groups = departments: a group reads its own documents plus Everyone; admins read everything. One group = one department of documents, because a document is filed under one department, so there is no new permission model.
  - The page leads with role tiles and group cards.
  - **People directory:** server-side search, filters and 25 per page (`/team/people`). Bulk changes (`/team/bulk`) use the same `access.py` rules (last-admin rule, manager scope).
  - **Invites:** role + groups chosen at invite time. **CSV import:** max 500 rows, dry run first.
  - The person × department grid and `GET /access` are removed.
- **Email-domain auto-join (owner OK):** `organizations.auto_join` (migration 0012). Rules:
  - real companies only, verified email only;
  - free-mail domains refused;
  - **only a domain one of the company's admins signs in with**, and one company per domain (so no one can claim someone else's staff);
  - joins as member or guest only, never the Managers group.
- **Open:** no DNS proof of domain ownership yet; `GET /team` (all people) is still used by Agents and should move to `/team/people`.

#### D-053 · Website chat in three tabs; website documents managed on the page
`2026-11-24 · active`
- **Problem:** the page was ~2,500 px long, visitor chats piled up endlessly, and it wasn't clear how to choose what the bot reads.
- **Decision:**
  - `/app/website?tab=setup|documents|conversations`.
  - **Conversations:** server-paged (20), with search, period and not-found filter. One chat opens in a side panel (`?chat=`), and its sources open in the doc viewer.
  - **Website documents:** "answers only from these N documents". Upload a file (becomes Everyone + public) or **Pick from Library**, Everyone documents only. Department documents show their department and can't be picked, so restricted documents never go public quietly.
- **Fixed:** `PATCH /documents/{id}` returned 500 after saving.

#### D-054 · Insights on Recharts (shadcn chart pattern), dataviz rules
`2026-11-24 · active`
- **Problem:** hand-made SVG charts looked unfinished with sparse data.
- **Decision:** `recharts` 3.11.0 pinned, wrapped by `components/ui/chart.tsx` (shadcn ChartContainer/Tooltip pattern, colours as `--chart-<key>`, reduced motion turns animation off). Series colours in `components/ui/chart.css`: accent blue and orange, checked with the dataviz palette checker in light and dark.
- **Forms:**
  - number tiles with change vs the previous period;
  - questions over time as stacked columns (daily for 7 and 30 days, weekly for 90; zero-day stubs; table view);
  - how questions ended as a **split bar, not a donut** (better for part-to-whole);
  - departments as ranked bars;
  - cited documents as a bar list linking to the viewer.
- **API:** `/insights` adds `per_day[].answered` and `previous` totals.
- **Open:** demo data sits on one day. Seeding a few weeks of question history in the demo reset would make the charts look like a real company (offered).

#### D-055 · Settings full width; profile pictures and company logo on our own server
`2026-11-24 · active`
- **Problem:** Settings was a narrow column with few options; no profile or picture.
- **Decision:**
  - Section menu (`?section=`): Profile (everyone); Company, Access defaults (incl. auto-join), Plan & usage, Notifications, Danger zone (admin only).
  - Preferences live in one JSON column, `organizations.settings` (migration 0013, plus `users.avatar`).
  - Notification switches are stored but **not sent**, and the page says so.
- **Images:**
  - Stored in the files volume (`<slug>/images/`), so no outside image service.
  - Checked by magic bytes and Pillow, max 2 MB, then re-encoded to a 256 px WebP, which strips metadata such as photo location.
  - Private: only the same company can load them. The browser crops and shrinks first, so big phone photos work.
- **Agent access:** token cards; 3-step setup with copy tabs (Claude Code, Claude Desktop, any MCP client); audit log paged on the server with filters (`/tokens/audit` response shape changed to `{items,total,page,per_page,tools}`).
- **Open:** removed people's picture files stay until a demo reset; images share the documents' (not yet off-server) backup.

#### D-056 · Ask and Search merged into one Ask page
`2026-11-24 · active (updates D-049: Work = Home, Ask, Library)`
- **Problem:** owner: "we have an Ask tab and a Search tab, they can be a single tab."
- **Decision:**
  - One Ask page, one input. In Answer mode the streamed answer with sources sits beside a "Matching documents" list. The list comes from `POST /search` for the same question, fetched in parallel, permission-filtered, one row per document. It is a right column at ≥ 960 px and a collapsible row above the input when narrower or when the viewer is open. It hides when the router says it wasn't a document question.
  - "Just find documents" (`?mode=find`) skips the LLM and lists documents full width.
  - The Search page and its nav item are removed.
- **Trade-off:** one extra retrieval per question. The list searches the raw words, not the rewritten question, so Hindi questions may list fewer documents than the answer cites.

#### D-057 · Library lists from its own paginated endpoint; drag-and-drop upload
`2026-11-24 · active`
- **Problem:** one 5,175 px list of every document; jargon ("Chunks", "Not yet"); clicking downloaded files.
- **Decision:**
  - `GET /documents/library` handles search (title or code), filters (department, type, status, needs review, public), sort and counts on the server, 20 per page. It always starts from `access.readable`, tested across 80 filter combinations per role so no one sees another department's documents.
  - `GET /documents` stays a plain list for Home and MCP. The list page parameter is `?p=` because the viewer owns `?page=`.
  - Rows open the side viewer. The upload dialog sets who can read first, then drag and drop of several files, with per-file progress and Processing → Ready. `?upload=1` opens it.
  - Ideas borrowed from the old Atlas: drop zone, per-file status list, errors under the title, processing and failed counts.

#### D-058 · Demo video re-recorded on the new UI; reproducible script
`2026-11-24 · active`
- **Decision:** `tools/demo-video/record.js` captures lossless page frames with Playwright (Playwright's built-in recording blurred the text and made a 2+ MB GIF), speeds up the AI waits, and encodes with the ffmpeg already on the machine (imageio-ffmpeg, libx264).
- **Story:** HR manager (Ritika) asks about earned leave → answer + Matching documents → citation opens the Leave Policy in the side viewer with the passage highlighted → Nimbus website bubble answers "What is NimbusOps?".
- **Outputs:** 28.6 s, 856 KB MP4 (landing + README), 914 KB GIF.
- **Gotchas:** the semantic cache answers instantly ("From cache"), so bump `atlas:cache:gen:<org>` before a take. The demo allows 40 questions a day per IP, so clear only the server IP's `plan:demo:*:<ip>:*` keys.

#### D-059 · Landing: option A, white by default, dark as a choice
`2026-11-24 · active` (answers Q7; live, owner approved 2026-11-24)
- **Decision:** A's layout and words; white page with light blue-grey bands; a switch in the header turns it dark. The choice is saved under the app's own key (`atlas-theme`). A computer set to dark mode still gets white first (owner's choice).
- Glows became soft shadows, the code box stays dark, every text colour passes 4.5:1 in both themes, and each theme has its own hero screenshot.

#### D-060 · Only "New chat" starts a new chat
`2026-11-24 · active` (answers Q8, owner's rule)
- **Decision:** the sidebar, Home's box and Find → Answer go back to the last chat. Find → Answer with the same words shows the existing answer, with no AI call.
- After 8 hours without activity, a new chat starts.
- **Kept in the browser per person, not on the server:** demo people are shared by every visitor, so the server's "latest chat" could be a stranger's. **Trade-off:** it does not follow you to another device (History does).

#### D-061 · Chat memory: small, and it knows the date
`2026-11-24 · active`
- **Problem:** owner: "is it holiday tom", then "what about next month this date" must be understood, without overloading the context. The models did not know today's date, and memory was the last 3 raw turns.
- **Decision:**
  - Each answer is stored with its standalone question ("Is 25 November 2026 a holiday at Nimbus?"). Memory = the last 4 turns with short answers + one line for each of 12 older questions, about 4,000 characters at most however long the chat is. No extra AI call (a summary model was rejected: slower, and it drops dates).
  - `when.py` does the date arithmetic; the model never does. If the rewrite fails or is slow, code moves the last question's date itself. Follow-ups and date questions get 6 s for the rewrite instead of 3.
  - A question about one day searches for its calendar by name ("holiday calendar 2026"): the day itself scored 0.7, below the 1.3 threshold; the calendar scores 2.5. For holiday look-ups that score decides, because the small model called a missing day "no" in 2 of 8 live runs.
  - Date-dependent answers are never cached, and a cached answer is refused when a number, month or weekday differs.

#### D-062 · Library: replace and delete; managers leave "Managers" to admins
`2026-11-24 · active` (answers Q9, Q10)
- **Replace** keeps the id, title, department, public flag and links. The old text answers until the new file is read. Version, effective and review dates are cleared, because they described the old file.
- A document deleted while it is being read leaves nothing behind (its chunks are removed at the end).
- Managers can read the shared Managers group but not upload, replace or delete there, the same scope as invites.

#### D-063 · Sample question history in the demo companies
`2026-11-24 · active` (answers Q11)
- **Decision:** 60 days from the exam's own questions and askers, `chats.origin = "sample"`. Insights says how many are samples; History, Home's recent chats and the owner's usage numbers leave them out. Refilled by every demo reset.

#### D-064 · Relevance check 6 s; thinking off in the code too
`2026-11-24 · active` (answers Q1, Q2)
- Measure the timeout rate after a few days of use.

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
