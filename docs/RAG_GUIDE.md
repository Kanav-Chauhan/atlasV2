# How Atlas does RAG (interview guide)

What Atlas v2 does at every RAG step, what the alternatives are, and what an interviewer will ask.
**Status** says what is built today and what is planned (phase number from PLAN.md). Keep it true:
update the status when a phase ships.

## The two stages

```
INDEXING (once per document)   Document → 1 Parse → 2 Chunk → 3 Embed → 4 Store
QUERYING (every question)      Question → 5 Transform → 6 Retrieve → 7 Rerank → 8 Generate → 9 Evaluate
```

## Step by step

| Step | Types that exist | Atlas uses | Why | Status |
|---|---|---|---|---|
| 1 Parse | plain text extraction (pypdf, PyMuPDF); layout-aware (Docling, Unstructured); OCR; vision-model parsing | **Docling** via LlamaIndex `DoclingReader`, OCR off, table structure on, exported to Markdown | documents are table-heavy; simple parsers jumble tables; runs locally | ✅ Phase 3 |
| 2 Chunk | fixed-size; recursive character; sentence-based; structure-aware; semantic; parent–child; proposition | **structure-aware** (`MarkdownNodeParser`) then **sentence-based** (`SentenceSplitter`, 512 tokens, 64 overlap) over the **whole document** (page markers map each chunk to its page, so headings carry across pages) + **contextual headers** (title, doc number and section path incl. the chunk's own heading are part of the embedded text). Re-ingest writes the new chunks first, then deletes the old ones | a numbered policy section is one topic; tables stay whole; a chunk alone lacks context; a failed re-ingest never empties a document | ✅ Phase 3, fixed Phase 4 |
| 3 Embed | dense bi-encoder; sparse (BM25, SPLADE); multi-vector (ColBERT); multilingual (bge-m3) | **dense, `BAAI/bge-small-en-v1.5`, 384 dims, local via FastEmbed** | strong on MTEB for its size, fast on CPU, free, data stays on our server | ✅ Phase 3 |
| 4 Store | vector DBs (Qdrant, Pinecone, Weaviate, Milvus); DB extensions (pgvector); search engines (Elasticsearch); libraries (FAISS, Chroma). Indexes: flat, IVF, HNSW, PQ. Metrics: cosine, dot, L2 | **Postgres + pgvector** via LlamaIndex `PGVectorStore` (table `data_chunks`), **HNSW index** (m=16, ef_construction=64), **cosine**, plus a Postgres full-text (tsvector) index for keyword search | vectors, keywords, metadata and permissions in one database, so the permission filter runs in the same SQL as the search; Qdrant only beyond ~10M chunks | ✅ Phase 3 |
| 5 Transform | rewriting; multi-query; HyDE; decomposition; step-back; routing; self-query | **router** in two stages: instant rules (greetings, thanks, "who are you", empty: reply + the user's suggested questions, no search, no AI call), then the `fast` model with **structured output** `{route: rag/offtopic/blocked, language: en/hi}`; **rewrite** with chat memory from the **LangGraph Postgres checkpointer** (thread = user + chat): standalone English query, "you/our company" → the org name, **Hindi/Hinglish → English** for search; plain English first questions skip the model call | follow-ups need context; small talk must not search; bge-small is English-only | ✅ Phase 5 |
| 6 Retrieve | sparse/keyword (BM25, full-text); dense/vector; hybrid. Fusion: RRF or weighted. Filters: pre vs post. MMR, parent-document, GraphRAG, agentic | **hybrid**: dense (pgvector) + Postgres full-text, top ~20 each, fused with **Reciprocal Rank Fusion** (score = Σ 1/(60 + rank)), **permission pre-filter** in both queries (`org_id`, `access` = Everyone or the user's departments, admin = all) | meaning + exact codes; RRF needs no score tuning; pre-filter cannot leak | ⏳ Phase 4 |
| 7 Rerank | cross-encoder; LLM reranker; ColBERT; Cohere Rerank (cloud) | **cross-encoder (bge-reranker), local**, top 20 → top 5; **superseded documents demoted** unless named | retrieve wide, rerank narrow | ⏳ Phase 4 |
| 8 Generate | grounding, citations, abstention, context ordering (lost in the middle), injection defence | `smart` (LangChain `ChatOpenAI` → LiteLLM gateway, `.with_fallbacks` to `smart-groq`, `smart-cf`), **numbered passages**, every claim cites `[n]`, same language as the question, streamed as the **AI SDK UI message stream**; **cite_check** runs on the token stream: unknown `[n]` removed, the rest renumbered 1, 2, 3 in order of use, `data-sources` lists only cited passages; **grade + one retry** (corrective RAG): top cross-encoder score < **1.3** → `fast` writes a different query → search again → still weak → exactly "Not found in your documents." + one-line reason, **no answer-model call**; **LLM Guard** (light scanners) + `fast` injection class; **semantic cache** (RedisVL) keyed by access scope | no guessing; verifiable answers; cache can't leak | ✅ Phase 5 (cache built, off until Redis 8) |
| 9 Evaluate | retrieval: Hit@k, Recall@k, Precision@k, MRR, nDCG. Generation (RAGAS): faithfulness, answer relevancy, context precision, context recall. LLM-as-judge | **187 questions** (`evals/demo_v2.json`, 34 must be refused, 20 must say "not found"): Hit@5, MRR, context recall, RAGAS faithfulness, permission leaks = 0, in **CI**; traces in **LangSmith** | the score proves the design | ⏳ Phase 6 |

**Architecture level:** Advanced RAG + **Adaptive** (router) + **Corrective** (grade and retry), built as a LangGraph graph.

## Enterprise concerns

| Concern | Atlas |
|---|---|
| Access control | role + department rule in one module (`access.py`), pre-filter in SQL, leak tests |
| Multi-tenancy | every query scoped by `org_id`; companies never share documents |
| Freshness | re-ingesting replaces a document's chunks; superseded documents ranked lower |
| Duplicates | same file (sha256 per company) is skipped |
| Privacy | parser, embeddings and reranker run on our server |
| Cost / speed | local models, semantic cache, no AI call when nothing is found |
| Observability | LangSmith traces each step |
| Quality gate | CI fails when scores drop |

## Numbers measured so far (Phase 3)

- Worker peak RAM while parsing: **1.9 GB** (limit 3 GB). PDF parse + embed: **26–52 s** each; DOCX/MD: **2.5–4.4 s**.
- Nimbus access check: guest **20** documents, engineer **43**, owner **68**.
- Old Atlas (v1) targets v2 must reach: Hit@5 **0.973**, MRR **0.789**, context recall **0.982**, faithfulness **0.995**, leaks **0**.

## Phase 5 decisions and numbers

- **Graph (LangGraph `StateGraph`)**: guard → route → (smalltalk | offtopic | blocked | rewrite) → cache_lookup → retrieve → grade → (answer | retry → rewrite → retrieve → grade → not_found) → cite_check → cache_store. The cache sits **after** rewrite because its key is the rewritten English question. Nodes stream `{"status"}` / `{"text"}` through the LangGraph stream writer; the API turns them into `data-status` / `text-delta` parts.
- **Grade threshold 1.3** (MiniLM cross-encoder logit of the top passage). Method: `python -m atlas_api.scripts.calibrate_grade --org nimbus` ran `hybrid_rerank` on Nimbus's questions in `evals/demo_v2.json`: 55 answerable (document in the top 5) vs 18 that must say not found (7 `not_found` + 11 `restricted` asked as the denied user). Best accuracy **0.904** at 1.314: 3 answerable questions fall below (one retry can rescue them), 4 negatives score above (related Everyone-documents exist; the grounded prompt then says what the documents don't cover). Re-run it when the reranker model changes. Result file: `evals/results/20261122T115032Z-grade.json`.
- **LLM Guard: light scanners only.** Importing even one module under `llm_guard.input_scanners` runs the package `__init__`, which loads torch, transformers, presidio and spaCy: **+418 MB RAM, 18 s import**, before the PromptInjection model (DeBERTa-v3, ~700 MB more). The API runs the embedder and reranker in ≤ 1.5 GB, so Atlas loads only `InvisibleText` (strips hidden Unicode) and `BanSubstrings` (known injection phrases, English + Hindi) without the package `__init__`: **+16 MB, 0.3 s**. The ML half of injection defence is the router: the `fast` model returns `blocked` for attempts to change rules or extract the prompt. Passages are also marked as data in the answer prompt.
- **Semantic cache (RedisVL `SemanticCache`)**: scope tag = sha256(org + role + sorted departments + answer language), admins = all departments; bge-small embedding of the rewritten English question; similarity ≥ 0.95 (cosine distance ≤ 0.05); TTL 24 h; never for questions that needed history, abstentions or answers without citations. Verified on a throwaway `redis:8-alpine`: same and paraphrased question hit, other question and other scope miss. **Off in production** (`ATLAS_SEMANTIC_CACHE=false`) because the stack runs `redis:7-alpine` (no query engine) and switching to `redis:8-alpine` waits until the re-ingest queue is empty.

## Interview questions (short answers)

1. **Walk me through your RAG pipeline.** → the 30-second answer below.
2. **Chunking strategy?** → structure-aware + sentence-based, 512/64, contextual headers; policies have sections and tables.
3. **How did you pick chunk size?** → small = precise but thin, big = context but noisy; 512 is the usual balance, checked with Hit@5.
4. **Embedding model?** → bge-small-en-v1.5: good MTEB score for its size, CPU-fast, free, private. Would try bge-m3 for many languages.
5. **Why pgvector, not Pinecone?** → permissions in the same query, one system, enough at our scale; Qdrant past ~10M chunks.
6. **What is HNSW?** → a layered neighbour graph for approximate nearest-neighbour search: fast, high recall, more memory than IVF.
7. **Dense vs sparse?** → meaning vs exact words; hybrid gets both.
8. **What is RRF?** → merge ranked lists by Σ 1/(k + rank), k = 60; ranks, not incomparable scores.
9. **Why rerank?** → a cross-encoder reads question and passage together, so it is more accurate; too slow for everything, so only the top 20.
10. **How do you prevent hallucination?** → grounding prompt, abstention threshold, verified citations, faithfulness metric.
11. **How are permissions enforced?** → pre-filter inside the search SQL, never post-filter; leak tests in CI.
12. **Pre- vs post-filtering?** → post-filtering can leak and returns fewer results than asked.
13. **Follow-up questions?** → chat memory + rewriting in LangGraph.
14. **How do you evaluate?** → retrieval (Hit@5, MRR, recall) + generation (RAGAS faithfulness, relevancy) on 187 golden questions, in CI.
15. **What would you improve?** → semantic or parent–child chunking, true BM25 (ParadeDB), multilingual embeddings, GraphRAG for relationship questions.

**Honest limits:** Postgres full-text ranking is `ts_rank`, not true BM25. bge-small is English-only, so Hindi is translated before search.

## The 30-second answer

> Atlas is a hybrid RAG system. Indexing: Docling parses documents layout-aware; I chunk structure-aware at 512 tokens with overlap and contextual headers; bge-small makes dense embeddings stored in pgvector with an HNSW cosine index. Querying: a LangGraph router skips search for small talk and rewrites follow-ups, then dense and full-text search run together, fused with RRF, with a permission pre-filter in the same SQL. A cross-encoder reranks the top 20 to 5; weak results retry once or abstain. Answers are grounded with verified citations, evaluated with Hit@5, MRR and RAGAS faithfulness on 187 questions in CI, with zero permission leaks.

## Learn it on Atlas

- **Phase 4: Retrieval lab** (super admin): one question → vector list, keyword list, RRF list and reranked list side by side with scores; switch modes and see Hit@5/MRR change on the 187 questions.
- **Phase 4: chunk viewer** in the Library: open a document and see its chunks (text, size, section path, page).
- **Phase 5: Ask page**: the status line shows each graph stage live; "Searched for:" shows the rewritten query; a weak search ends in "Not found" with a Request-a-document button.
- **Phase 6:** each question's full path in LangSmith (router → rewrite → retrieve → grade → answer).
