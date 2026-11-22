# Atlas v2 — the whole plan

Agreed with the owner on 2026-11-22. Nothing is built yet; Phase 0 starts on the owner's **GO**.

**Repo:** github.com/Kanav-Chauhan/atlasV2 (fully from scratch) · **Live at:** p10.kanav.space

---

## 1. What Atlas is

| Part | For | What it does |
|---|---|---|
| **Atlas for staff** | Employees | Ask or search the company's documents and get answers with sources. Each person sees only what their role and departments allow. |
| **Atlas for websites** | Website visitors | The company marks documents as public and pastes a one-line snippet on its website. A chat bubble answers visitors from those public documents only. |

## 2. What we bring from the old Atlas (`atlas-rag-platform`)

| Brought over | Written new |
|---|---|
| 171 demo documents (`demo_corpus/`) | All backend code |
| 122 eval questions | The RAG pipeline |
| Landing page design (sapphire r2-h1) | The whole dashboard |
| Login page design | Website chat, database, tests, deployment |

No old backend or dashboard code is copied.

**Launch rule:** v2 must reach **Hit@5 ≥ 0.97 with 0 permission leaks** (the old Atlas's score) before it replaces p1.

## 3. Roles and departments

**Role = what you can do. Department = what you can see.**

| Role | Who | Can do |
|---|---|---|
| **Super admin** | Owner of Atlas only | All companies, evals, model comparison, LangSmith traces, costs, cache and safety stats, waitlist, plans, read-only view of any company |
| **Admin** | Company owner | Settings, departments, people, who-sees-what, website chat, plan, plain insights, audit counts |
| **Manager** | Department head | Own department's documents, add people to own department, department insights |
| **Member** | Employee | Ask and search within own departments |
| **Guest** | Contractor or intern | "Everyone" documents only, read-only |
| *Website visitor* | Public (automatic) | Public documents only, through the chat bubble |

Departments are created freely by the admin (HR, Engineering, Finance and so on). Each person has one role and one or more departments.

Technical evaluation (Hit@5, RAGAS, traces, model comparison) lives in **super admin**. Company admins get plain insights ("92% answered", "top unanswered questions").

## 4. Demo companies

| Company | Departments |
|---|---|
| **Nimbus Infotech** (IT) | HR · Engineering (BRDs, design docs, runbooks) · Product · Finance · Legal · Sales · IT Security · Leadership |
| **Sanjeevani Pharma** | HR · R&D · Quality & Manufacturing · Regulatory · Finance · Sales · Leadership |
| **Kaveri Capital** (finance) | HR · Investments · Compliance & Legal · Finance · Client Services · Operations · Leadership |

- **New documents:** about 8–10 per company to fill the gaps (BRDs, project plans, contracts, sales sheets).
- **Logins:** one-click for Admin, 2–3 Managers, 2–3 Members and 1 Guest per company.
- **Suggested questions** for each role on Home.
- **"Try as another role"** button to show the permission difference live.

## 5. How a message is answered (LangGraph)

```
Message
  → LLM Guard (injection / unsafe check)
  → Semantic cache ── asked before? → instant answer
  → Router
       ├─ "Hi", "thanks"   → friendly reply + suggested questions (NO search)
       ├─ off-topic        → "I only answer about company documents" (NO search)
       └─ question / follow-up
  → Rewrite (chat memory; Hindi/Hinglish understood)
  → Retrieve: LlamaIndex hybrid (vector + keyword), permission filter INSIDE the database query
  → Rerank
  → Grade ── weak? → retry once → still weak → "Not found in your documents"
  → Answer with [n] citations (same language as the question)
  → Check citations → Stream → 👍/👎 → LangSmith trace
```

The router fixes the old bug where "Hi" ran a full search and rerank. It works in two stages:
1. **Instant rules** catch greetings and thanks, with no AI call.
2. **The `fast` model** sorts everything else.

## 6. Tech stack

### The core 4 + the exam

| Framework | Job | Picture |
|---|---|---|
| **LlamaIndex** | Read (Docling reader), split, embed, store, retrieve, rerank | 📚 Librarian |
| **LangGraph** | Message flow: guard, router, retry, memory | 🧠 Brain |
| **LangChain** | Model calls, prompts, structured output, semantic cache | 🗣️ Mouth |
| **LangSmith** | Traces of every AI step, prompt tests | 👀 CCTV |
| **RAGAS** | Answer-quality scores, run in CI | 📝 Exam |

Interview line: *"LlamaIndex is my data layer, LangGraph is my agent workflow, LangChain is my model layer, LangSmith is my observability, and RAGAS is my eval gate."*

### Everything else

| Layer | Tool | Why |
|---|---|---|
| Parsing | **Docling** (via LlamaIndex `DoclingReader`) | Keeps tables; runs locally, so documents stay on our server |
| AI models | **LiteLLM gateway** (`~/deploy/ai-gateway`): NVIDIA NIM first, Groq and Cloudflare as backups | Free; keys already there. Slots: `fast` = router, `smart` = answers, `json` = eval judge |
| Embeddings, reranker | bge (FastEmbed) + bge-reranker, local | Free, fast, no rate limits |
| Safety | **LLM Guard** | Blocks prompt injection on staff and public chat |
| Database | **Postgres + pgvector** | Data, vectors, keyword search and permissions in **one** query |
| ORM / migrations | **SQLAlchemy 2 + Alembic** | Handles complex search queries; versioned schema |
| API shapes | **Pydantic v2** | Validated requests and responses |
| Background jobs | **Celery + Redis** | Redis is already needed for cache, rate limits and memory; tasks are idempotent; RabbitMQ is a one-line broker swap later |
| Backend | **FastAPI** | Async, standard |
| Frontend | **Next.js 16, Tailwind, shadcn/ui, TanStack Query** | Standard modern stack |
| Chat UI | **Vercel AI SDK + AI Elements** | Ready-made streaming chat |
| Agent access | **MCP Python SDK** | AI agents search Atlas with user-level permissions |
| Login | **Clerk** | Authentication; authorization stays in our own Postgres tables |
| Product analytics | **PostHog** (EU) | Visitor → question → waitlist funnel |
| Code quality | **uv, ruff, mypy, pre-commit** | Locked versions, lint, types, checks before every commit |
| Tests | **pytest** (unit + integration), **Playwright** (browser), **RAGAS** (quality) | Every layer covered |
| Server monitoring | **OpenTelemetry + Prometheus + Grafana** | Latency, errors, alerts |
| Deploy | **Docker Compose + Caddy** on the VPS, **GitHub Actions** CI, **Helm chart** as proof | Kubernetes-ready |

### Deliberately skipped

| Skipped | Why |
|---|---|
| Pinecone, Qdrant, Weaviate | pgvector keeps vectors and permissions in one database; move to Qdrant only at very large scale |
| LlamaParse, Unstructured (cloud) | Paid; company documents would leave the server |
| CrewAI, AutoGen | Atlas has one fixed flow, not a team of agents |
| Haystack | Duplicates LlamaIndex |
| DeepEval | Duplicates RAGAS + LangSmith evals |
| OpenFGA | Overkill for roles + departments |
| RabbitMQ | Redis is enough at our volume and is already in the stack |
| Langfuse | Owner chose LangSmith |

Outside services allowed for Atlas: Clerk, PostHog, PayU, Anthropic API, LangSmith. Everything else is self-hosted.

## 7. Dashboard (new design; sapphire blue, light + dark)

| Page | Who |
|---|---|
| **Home**: ask box, suggested questions, recent chats | Everyone |
| **Ask**: streamed chat, citations, source preview, "try as another role", 👍/👎 | Everyone |
| **Search**: plain results, no AI | Everyone |
| **Library**: documents by department, upload, status, superseded badge, public on/off, "needs review" reminder | Everyone (managers and admin edit) |
| **Team & access**: people, departments, who-sees-what grid | Admin (managers: own department) |
| **Website chat**: public sources, snippet, bubble style, live preview, visitor chats | Admin |
| **Insights**: answered %, top unanswered questions, usage vs plan, feedback, audit counts (no names) | Admin (managers: own department) |
| **Agent access**: MCP tokens | Admin |
| **Settings & plan** | Admin |
| **Super admin area**: all companies, evals, model comparison, traces, costs, cache hit rate, blocked attacks, waitlist | Owner of Atlas only |

### Design decisions (owner, 2026-11-22)

- **Shell:** option C's thin icon bar on every page (bottom tab bar on phones). Menu items follow the role (see §3).
- **Ask:** option C: big chat, past chats behind a "History" button, suggested questions as chips above the composer, document reader opens when a citation is clicked (Small / Half / Full, drag handle, close).
- **Team & access:** option A's content (people table, who-sees-what grid, empty state) inside the C shell.
- **Other pages** (Home, Search, Library, Insights, Website chat, Settings, Super admin) are built in the same style.
- **No role switching** in the app. Demo visitors pick a person on the login page; each login lands on that person's own dashboard. A "Log out" link goes back to the login page.
- Previews: `previews/dashboard/option-c` (Ask) and `option-a/team.html` (Team content).

## 8. Login and plans

- **Demo:** one-click role logins, no sign-up needed.
- **Real users:** Clerk sign-up (Google and email).
- **Plans:**

| Free | Pro ₹1,499/month | Enterprise |
|---|---|---|
| Demo only, 100 AI answers/month | Own company + website chat | "Let's talk" |

- **Payments:** waitlist first, PayU after 100+ Pro sign-ups.

## 9. Build phases

| # | Phase | Result to see |
|---|---|---|
| 0 | **Design**: 2–3 dashboard preview options + the new document list | Previews at p10 (password-protected); owner picks one |
| 1 | **Skeleton**: repo, uv/ruff/mypy/pre-commit, Docker, Caddy at p10, CI, landing + login | p10 live |
| 2 | **Demo data**: departments, new documents, demo users, suggested questions | Document list to review |
| 3 | **Ingestion**: LlamaIndex + Docling + Celery | Library filled |
| 4 | **Retrieval + permissions** + leak tests | Search works per role |
| 5 | **LangGraph flow**: guard, cache, router, memory, Hindi, citations | Ask works, "Hi" fixed |
| 6 | **LangSmith + RAGAS** in CI | Super admin quality page |
| 7 | **Full dashboard** (AI Elements chat) + Playwright tests | Complete app |
| 8 | **Website chat**: snippet, widget, public role, sample websites | Live chat bubble |
| 9 | **MCP server** | Agents can use Atlas |
| 10 | **SaaS**: Clerk, plans and limits, PostHog, waitlist | Sign-up works |
| 11 | **Launch**: beat the target scores, Grafana monitoring, Helm chart, README, demo GIF, p1 → p10 redirect | Public launch |

**Later (not v1):** Excel/PowerPoint/OCR, Google Drive/SharePoint/Notion sync, PayU payments.

## 10. How we work

- 2–3 agents in parallel.
- `PROGRESS.md` updated after every step, with the session id and resume command.
- Pushed to atlasV2 on GitHub as we go.
- Work stops at 90% of the weekly limit, with state saved.
- Heavy tests (corpus, retrieval) run in GitHub CI, not on the VPS (RAM is tight, about 5 GB free).
- p10 runs on its own port (3011) behind Caddy; the old Atlas at p1 is never touched until launch.

## 11. Defaults used (owner can still change them)

- p1 redirects to p10 at launch.
- Keep the 3 demo companies.
- Hindi/Hinglish questions: yes.
- 👍/👎 on answers: yes.
- "Needs review" reminders for old documents: yes.
- Audit log: counts only, no names.
- Dashboard: sapphire blue, light + dark.
