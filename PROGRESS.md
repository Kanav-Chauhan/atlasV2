# Atlas v2 — progress log

Plan: [PLAN.md](PLAN.md). Updated after every step.

| Date (IST) | Step | Status |
|---|---|---|
| 2026-11-22 | Plan agreed with owner, PLAN.md pushed | ✅ |
| 2026-11-22 | Phase 0: 3 dashboard options (A Library desk, B Command bar, C Reader) built with Hallmark, live at p10.kanav.space (password) | ✅ |
| 2026-11-22 | Phase 0: all 3 options updated to finished-product look (no role switching; Ritika = HR manager on Ask, Vikram = admin on Team; C: no 2nd column, resizable reader) | ✅ |
| 2026-11-22 | Phase 0: demo document list (docs/DEMO_DOCUMENTS.md): 171 kept + 28 new, 21 users; 4 owner decisions open | ✅ |

**Session:** 5233bd45-1971-4737-8cc0-999ba49f18fb · resume: `cd ~ && claude --resume 5233bd45-1971-4737-8cc0-999ba49f18fb`

| Date (IST) | Step | Status |
|---|---|---|
| 2026-11-22 | Design locked: C icon bar everywhere, Ask = C, Team & access = A's content in the C shell, no role switching (PLAN.md "Design decisions") | ✅ |
| 2026-11-22 | Owner answered demo-data questions: Managers dept yes, Nimbus leave/notice/referral = Everyone, Admin sees all | ✅ |
| 2026-11-22 | Phase 1 CI green (api, web, images) | ✅ |
| 2026-11-22 | Phase 1: FastAPI + Postgres/pgvector + Redis + Celery + Next.js 16 (landing, login, role-based /app shell) live at p10 (password), previews at /previews/ | ✅ |
| 2026-11-22 | Phase 2: 199 docs (171 remapped + 28 new, rendered), orgs/<slug>.json (21 users, departments incl. Managers, suggested questions), evals/demo_v2.json (187 q: 34 restricted, 20 not_found); public docs = Everyone | ✅ |
| 2026-11-22 | Phase 3: schema (0002), seed, load_corpus, LlamaIndex+Docling+FastEmbed(bge-small)+PGVectorStore hybrid ingestion via Celery, HNSW cosine index (0003), access.py + API per docs/API.md, Library page; all 199 docs queued | ✅ (ingesting) |
| 2026-11-22 | Phase 3 backend: schema 0002, seed + load_corpus, Celery ingest (Docling → Markdown → MarkdownNodeParser + SentenceSplitter 512/64 → FastEmbed bge-small → PGVectorStore `data_chunks` hybrid), access.py, /me /documents /departments endpoints; nimbus ingesting (PDF ~26-52 s, docx/md ~3 s, worker peak ~1.9 GB) | ✅ |
| 2026-11-22 | docs/RAG_GUIDE.md (interview guide, built vs planned); Retrieval lab + chunk viewer added to Phase 4 | ✅ |
| 2026-11-22 | Phase 3 done: all 199 documents ready. Phase 4 TODO found by note writers: (1) PGVectorStore 'hybrid' joins lists without RRF → use QueryFusionRetriever(mode=reciprocal_rerank) over vector + text retrievers; (2) chunking per PDF page loses section headings across pages → chunk the whole document with page markers, then re-ingest | ✅ / TODO |
| 2026-11-22 | Nimbus: added Rohan Bhatia (CFO, Finance), Farah Siddiqui (Head of Legal), Sameer Khan (CISO, IT Security) as managers; 12 eval questions moved to them; Docker build cache pruned after every build | ✅ |
| 2026-11-22 | Phase 4 TODO (3): re-ingest deletes old chunks before writing new ones, so a failed re-ingest leaves the document with no chunks → write new chunks first, then delete old ones by id (or one transaction) | TODO |
