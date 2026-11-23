"""How a message is answered: a LangGraph StateGraph (PLAN.md §5).

guard → route → (smalltalk | offtopic | blocked | rewrite) → cache_lookup → retrieve → grade
  grade weak → rewrite once with a different formulation → retrieve → grade
  → answer | not_found → cite_check → cache_store

grade (corrective RAG, Phase 6) has two checks: the cross-encoder's top score against a
calibrated threshold, then the `fast` model's relevance verdict (yes / partial / no + which
passages). Only the passages it marks reach the answer model.

The semantic cache sits after rewrite because its key is the rewritten English question.
Nodes stream to the client through the runtime stream writer: {"status": stage} and
{"text": delta}. The chat history lives in the LangGraph checkpointer (thread = user + chat).
"""

import asyncio
import logging
import re
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import AIMessage, AnyMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.runtime import Runtime
from langgraph.types import Checkpointer
from llama_index.core.schema import NodeWithScore
from llama_index.core.vector_stores import MetadataFilters

from atlas_api import citations, guard
from atlas_api.cache import AnswerCache
from atlas_api.llm import Models, history_text
from atlas_api.settings import settings

log = logging.getLogger(__name__)

NOT_FOUND = "Not found in your documents."
NOT_FOUND_REASON = {
    "en": "No document you can open answers this, so Atlas did not guess.",
    "hi": "आप जिन दस्तावेज़ों को खोल सकते हैं, उनमें से किसी में इसका जवाब नहीं है, "
    "इसलिए Atlas ने अनुमान नहीं लगाया।",
}
# Website visitors (Phase 8): no "your documents"; point them to the company instead.
VISITOR_NOT_FOUND = {
    "en": "I couldn't find that in {org}'s public information. "
    "Please contact {org} directly and they will help you.",
    "hi": "मुझे यह {org} की सार्वजनिक जानकारी में नहीं मिला। कृपया सीधे {org} से संपर्क करें, वे आपकी मदद करेंगे।",
}


class State(TypedDict, total=False):
    messages: Annotated[list[AnyMessage], add_messages]  # the thread's history (checkpointed)
    question: str
    route: str  # smalltalk | offtopic | blocked | rag
    smalltalk: str  # greeting | thanks | who | bye
    language: str  # en | hi
    query: str  # the search query (rewritten, English)
    first_query: str  # the first rewrite: the semantic-cache key
    used_history: bool
    attempt: int
    passages: list[dict[str, Any]]
    top_score: float
    grade: str  # answer | retry | not_found
    relevance: str  # yes | partial | no | skipped (score too low) | off | error
    grade_log: list[dict[str, Any]]  # one entry per grade: score, verdict, kept passage numbers
    cite_order: list[int]  # original passage numbers in the order the answer cites them
    answer: str
    sources: list[dict[str, Any]]
    abstained: bool
    cached: bool


def new_turn(question: str) -> State:
    """Graph input for one message: resets every per-turn field, appends the question."""
    return State(
        messages=[HumanMessage(question)],
        question=question,
        route="",
        smalltalk="",
        language="en",
        query="",
        first_query="",
        used_history=False,
        attempt=0,
        passages=[],
        top_score=0.0,
        grade="",
        relevance="",
        grade_log=[],
        cite_order=[],
        answer="",
        sources=[],
        abstained=False,
        cached=False,
    )


SearchFn = Callable[[str, MetadataFilters], list[NodeWithScore]]


@dataclass
class Ctx:
    """Per-request context (not checkpointed): who is asking and the swappable parts."""

    org: str
    filters: MetadataFilters
    scope: Callable[[str], str]  # language -> permission-safe cache scope
    suggested: list[str] = field(default_factory=list)
    threshold: float = 1.3
    models: Models = field(default_factory=Models)
    search: SearchFn | None = None
    cache: AnswerCache | None = None
    # Website visitor (Phase 8): public documents only, no suggestions, website wording.
    visitor: bool = False
    greeting: str = ""
    # LLM relevance grade after the score threshold (ATLAS_RELEVANCE_GRADE).
    relevance: bool = field(default_factory=lambda: settings.relevance_grade)


# ---------------------------------------------------------------- instant rules (no AI call)

_PUNCT = re.compile(r"[\s.,!?;:'\"()\-…।🙏😊🙂👋]+")
SMALLTALK: dict[str, re.Pattern[str]] = {
    "greeting": re.compile(
        r"^(hi+|hello+|hey+|hiya|yo|namaste|namaskar|hola|good (morning|afternoon|evening)"
        r"|(hi|hello|hey) (there|atlas)|नमस्ते|नमस्कार|हेलो|हाय)$"
    ),
    "thanks": re.compile(
        r"^(thanks?|thank you|thank you so much|thanks a lot|thx|ty|cheers|great|ok|okay|cool"
        r"|got it|perfect|nice|dhanyavaad|dhanyavad|shukriya|धन्यवाद|शुक्रिया|ठीक है)"
        r"( (atlas|a lot|so much))?$"
    ),
    "who": re.compile(
        r"^(who are you|what are you|what is atlas|what can you do|how can you help( me)?"
        r"|help|what do you do|tum kaun ho|aap kaun ho|तुम कौन हो|आप कौन हैं)$"
    ),
    "bye": re.compile(r"^(bye|goodbye|see you|alvida|अलविदा)$"),
}


def smalltalk_kind(text: str) -> str | None:
    flat = _PUNCT.sub(" ", text.casefold()).strip()
    if not flat:
        return "greeting"
    return next((k for k, p in SMALLTALK.items() if p.match(flat)), None)


def script_language(text: str) -> str:
    return "hi" if re.search(r"[ऀ-ॿ]", text) else "en"


_COMPANY_WORDS = re.compile(r"\b(you|your|yours|we|our|us|the company)\b", re.I)


def suggestions(ctx: Ctx) -> str:
    return "\n".join(f"- {q}" for q in ctx.suggested[:3])


def visitor_smalltalk(kind: str, language: str, ctx: Ctx) -> str:
    if kind == "thanks":
        return f"You're welcome. Ask me anything else about {ctx.org}."
    if kind == "bye":
        return "Bye! Thanks for visiting."
    if kind == "who":
        return (
            f"I'm the assistant on {ctx.org}'s website. I answer from {ctx.org}'s public "
            "information and show where each answer came from."
        )
    if language == "hi":
        return f"नमस्ते! {ctx.org} के बारे में कुछ भी पूछिए।"
    return ctx.greeting or f"Hi! Ask me anything about {ctx.org}."


def smalltalk_reply(kind: str, language: str, ctx: Ctx) -> str:
    if ctx.visitor:
        return visitor_smalltalk(kind, language, ctx)
    try_these = f"\n\nTry one of these:\n{suggestions(ctx)}" if ctx.suggested else ""
    if kind == "thanks":
        return f"You're welcome. Ask me anything else about {ctx.org} documents."
    if kind == "bye":
        return "Bye! Come back any time you need something from your documents."
    if kind == "who":
        return (
            f"I'm Atlas, the document assistant for {ctx.org}. I answer only from documents "
            "you can open, and every answer shows the passages it came from." + try_these
        )
    if language == "hi":
        return f"नमस्ते! मैं {ctx.org} के दस्तावेज़ों से आपके सवालों के जवाब देता हूँ।" + try_these
    return f"Hi! I answer questions from {ctx.org} documents you can open." + try_these


# ---------------------------------------------------------------- nodes


def _say(runtime: Runtime[Ctx], text: str) -> None:
    runtime.stream_writer({"text": text})


def _status(runtime: Runtime[Ctx], stage: str) -> None:
    runtime.stream_writer({"status": stage})


async def guard_node(state: State, runtime: Runtime[Ctx]) -> dict[str, Any]:
    _status(runtime, "guard")
    verdict = guard.check(state["question"])
    if verdict.blocked:
        log.warning("guard blocked a message: %s", verdict.reason)
        return {"route": "blocked", "question": verdict.text}
    return {"question": verdict.text}


async def route_node(state: State, runtime: Runtime[Ctx]) -> dict[str, Any]:
    _status(runtime, "route")
    q = state["question"]
    lang = script_language(q)
    if kind := smalltalk_kind(q):
        return {"route": "smalltalk", "smalltalk": kind, "language": lang}
    ctx = runtime.context
    try:
        out = await ctx.models.route(q, ctx.org, history_text(state["messages"][:-1]))
        return {"route": out.route, "language": "hi" if lang == "hi" else out.language}
    except Exception:
        log.exception("router model failed; treating the message as a question")
        return {"route": "rag", "language": lang}


def after_guard(state: State) -> Literal["blocked", "route"]:
    return "blocked" if state.get("route") == "blocked" else "route"


def after_route(state: State) -> str:
    return {"smalltalk": "smalltalk", "offtopic": "offtopic", "blocked": "blocked"}.get(
        state["route"], "rewrite"
    )


def _reply(state: State, text: str, runtime: Runtime[Ctx]) -> dict[str, Any]:
    _say(runtime, text)
    return {"answer": text, "messages": [AIMessage(text)]}


async def smalltalk_node(state: State, runtime: Runtime[Ctx]) -> dict[str, Any]:
    text = smalltalk_reply(state["smalltalk"], state["language"], runtime.context)
    return _reply(state, text, runtime)


async def offtopic_node(state: State, runtime: Runtime[Ctx]) -> dict[str, Any]:
    ctx = runtime.context
    text = f"I only answer questions about {ctx.org}{'' if ctx.visitor else ' documents'}."
    if ctx.suggested:
        text += f" For example:\n{suggestions(ctx)}"
    return _reply(state, text, runtime) | {"route": "offtopic"}


async def blocked_node(state: State, runtime: Runtime[Ctx]) -> dict[str, Any]:
    org = runtime.context.org
    text = (
        f"I can't help with that. I answer questions about {org}."
        if runtime.context.visitor
        else f"I can't help with that. I answer questions about {org} documents you can open."
    )
    return _reply(state, text, runtime) | {"route": "blocked"}


async def rewrite_node(state: State, runtime: Runtime[Ctx]) -> dict[str, Any]:
    ctx = runtime.context
    q = state["question"]
    if state.get("attempt", 0) > 0:  # corrective retry: a different formulation
        _status(runtime, "retry")
        try:
            alt = await ctx.models.reformulate(state["query"], ctx.org)
        except Exception:
            log.exception("reformulate failed")
            alt = ""
        return {"query": alt or state["query"]}
    _status(runtime, "rewrite")
    history = state["messages"][:-1]
    needs_model = bool(history) or state["language"] == "hi" or _COMPANY_WORDS.search(q)
    if not needs_model:
        return {"query": q, "first_query": q, "used_history": False}
    try:
        out = await ctx.models.rewrite(q, ctx.org, history_text(history))
        query = out.query.strip() or q
        used = bool(history) and out.used_history
    except Exception:
        log.exception("rewrite failed; searching with the question as asked")
        query, used = q, bool(history)
    return {"query": query, "first_query": query, "used_history": used}


def after_rewrite(state: State) -> Literal["cache_lookup", "retrieve"]:
    return "retrieve" if state.get("attempt", 0) > 0 else "cache_lookup"


async def cache_lookup_node(state: State, runtime: Runtime[Ctx]) -> dict[str, Any]:
    ctx = runtime.context
    if ctx.cache is None or state["used_history"]:
        return {}
    _status(runtime, "cache")
    try:
        hit = await ctx.cache.lookup(state["query"], ctx.scope(state["language"]))
    except Exception:
        log.exception("semantic cache lookup failed")
        return {}
    if not hit:
        return {}
    _say(runtime, hit["answer"])
    return {
        "cached": True,
        "answer": hit["answer"],
        "sources": hit["sources"],
        "messages": [AIMessage(hit["answer"])],
    }


def after_cache(state: State) -> str:
    return END if state.get("cached") else "retrieve"


def passage(n: NodeWithScore) -> dict[str, Any]:
    m = n.node.metadata
    return {
        "chunk_id": n.node.node_id,
        "document_id": int(n.node.ref_doc_id or m.get("document_id") or 0),
        "title": m.get("title", ""),
        "doc_no": m.get("doc_no") or None,
        "page": m.get("page"),
        "section": m.get("header_path") or None,
        "text": n.node.get_content(),
        "superseded": bool(m.get("superseded")),
        "effective": m.get("effective") or None,
        "score": float(n.score or 0.0),
    }


def default_search(q: str, filters: MetadataFilters) -> list[NodeWithScore]:
    from atlas_api import retrieve

    return retrieve.search(q, filters, "hybrid_rerank").final


async def retrieve_node(state: State, runtime: Runtime[Ctx]) -> dict[str, Any]:
    _status(runtime, "retrieve")
    ctx = runtime.context
    hits = await asyncio.to_thread(ctx.search or default_search, state["query"], ctx.filters)
    passages = [passage(h) for h in hits]
    return {"passages": passages, "top_score": passages[0]["score"] if passages else -99.0}


async def grade_node(state: State, runtime: Runtime[Ctx]) -> dict[str, Any]:
    """Corrective RAG in two checks. 1: the cross-encoder's top score against a calibrated
    threshold (cheap, no AI call). 2: the `fast` model reads the passages and says whether
    they answer the question (yes / partial / no + which passages). Weak or "no" → one retry
    with a different query, then "not found".
    The grade is a GATE, not a filter: on yes/partial ALL passages go to the answer model.
    Keeping only the marked ones (first version) cut fully correct answers from 149 to 140
    of 167 in the Phase 6 exam: the second half of an answer often sat in an unmarked passage
    (evals/grading/run1)."""
    _status(runtime, "grade")
    ctx = runtime.context
    passages = state["passages"]
    fail = {"grade": "retry" if state.get("attempt", 0) == 0 else "not_found"}
    log_entry: dict[str, Any] = {"attempt": state.get("attempt", 0), "score": state["top_score"]}
    grade_log = [*state.get("grade_log", []), log_entry]
    if not passages or state["top_score"] < ctx.threshold:
        log_entry["verdict"] = "skipped"
        return fail | {"relevance": "skipped", "grade_log": grade_log}
    if not ctx.relevance:
        log_entry["verdict"] = "off"
        return {"grade": "answer", "relevance": "off", "grade_log": grade_log}
    try:
        out = await ctx.models.relevance(
            state["question"], state["query"], passages_text(passages), ctx.org
        )
    except Exception:
        log.exception("relevance grade failed; answering on the score alone")
        log_entry["verdict"] = "error"
        return {"grade": "answer", "relevance": "error", "grade_log": grade_log}
    log_entry |= {"verdict": out.verdict, "marked": out.passages}
    if out.verdict == "no":
        return fail | {"relevance": "no", "grade_log": grade_log}
    return {"grade": "answer", "relevance": out.verdict, "grade_log": grade_log}


def after_grade(state: State) -> str:
    return state["grade"]


async def retry_marker(state: State) -> dict[str, Any]:
    return {"attempt": state.get("attempt", 0) + 1}


def passages_text(passages: list[dict[str, Any]]) -> str:
    out = []
    for i, p in enumerate(passages, 1):
        where = ", ".join(
            x
            for x in (
                p.get("doc_no"),
                f"section {p['section']}" if p.get("section") not in (None, "/") else None,
                f"page {p['page']}" if p.get("page") else None,
                # the document's date, so the answer model can tell an older snapshot from
                # the current figure (Phase 6 exam: an interim report beat the newer status)
                f"dated {p['effective']}" if p.get("effective") else None,
            )
            if x
        )
        flag = " [SUPERSEDED]" if p.get("superseded") else ""
        out.append(f"[{i}] {p['title']}{f' ({where})' if where else ''}{flag}\n{p['text']}")
    return "\n\n".join(out)


async def answer_node(state: State, runtime: Runtime[Ctx]) -> dict[str, Any]:
    _status(runtime, "answer")
    ctx = runtime.context
    cites = citations.Citations(len(state["passages"]))
    parts: list[str] = []
    async for delta in ctx.models.answer(
        state["question"], state["query"], passages_text(state["passages"]), ctx.org
    ):
        if out := cites.feed(delta):
            parts.append(out)
            _say(runtime, out)
    if out := cites.flush():
        parts.append(out)
        _say(runtime, out)
    return {"answer": "".join(parts), "cite_order": cites.order}


async def not_found_node(state: State, runtime: Runtime[Ctx]) -> dict[str, Any]:
    lang = state["language"]
    if runtime.context.visitor:
        text = VISITOR_NOT_FOUND.get(lang, VISITOR_NOT_FOUND["en"]).format(org=runtime.context.org)
    else:
        text = f"{NOT_FOUND}\n{NOT_FOUND_REASON.get(lang, NOT_FOUND_REASON['en'])}"
    _say(runtime, text)
    return {"answer": text, "abstained": True, "passages": []}


async def cite_check_node(state: State) -> dict[str, Any]:
    """The answer was checked while it streamed (citations.Citations: unknown [n] removed,
    the rest renumbered 1, 2, 3); this builds the source list from that same mapping, so
    `data-sources` holds only cited passages, and records the turn in the history."""
    order = state.get("cite_order") or []
    sources = [
        {k: v for k, v in state["passages"][old - 1].items() if k != "score"} | {"n": new}
        for new, old in enumerate(order, 1)
    ]
    if not state["abstained"] and not sources:
        log.warning("answer has no valid citation: %r", state["question"][:80])
    return {"sources": sources, "messages": [AIMessage(state["answer"])]}


async def cache_store_node(state: State, runtime: Runtime[Ctx]) -> dict[str, Any]:
    ctx = runtime.context
    if ctx.cache is None or state["used_history"] or state["abstained"] or not state["sources"]:
        return {}
    try:
        await ctx.cache.store(
            state["first_query"],
            ctx.scope(state["language"]),
            {"answer": state["answer"], "sources": state["sources"]},
        )
    except Exception:
        log.exception("semantic cache store failed")
    return {}


def build(checkpointer: Checkpointer = None) -> Any:
    g = StateGraph(State, context_schema=Ctx)
    g.add_node("guard", guard_node)
    g.add_node("route", route_node)
    g.add_node("smalltalk", smalltalk_node)
    g.add_node("offtopic", offtopic_node)
    g.add_node("blocked", blocked_node)
    g.add_node("rewrite", rewrite_node)
    g.add_node("cache_lookup", cache_lookup_node)
    g.add_node("retrieve", retrieve_node)
    g.add_node("grade", grade_node)
    g.add_node("retry", retry_marker)
    g.add_node("answer", answer_node)
    g.add_node("not_found", not_found_node)
    g.add_node("cite_check", cite_check_node)
    g.add_node("cache_store", cache_store_node)

    g.add_edge(START, "guard")
    g.add_conditional_edges("guard", after_guard)
    g.add_conditional_edges("route", after_route)
    for terminal in ("smalltalk", "offtopic", "blocked"):
        g.add_edge(terminal, END)
    g.add_conditional_edges("rewrite", after_rewrite)
    g.add_conditional_edges("cache_lookup", after_cache)
    g.add_edge("retrieve", "grade")
    g.add_conditional_edges(
        "grade",
        after_grade,
        {"answer": "answer", "retry": "retry", "not_found": "not_found"},
    )
    g.add_edge("retry", "rewrite")
    g.add_edge("answer", "cite_check")
    g.add_edge("not_found", "cite_check")
    g.add_edge("cite_check", "cache_store")
    g.add_edge("cache_store", END)
    return g.compile(checkpointer=checkpointer)


def timer() -> Callable[[], int]:
    start = time.perf_counter()
    return lambda: round((time.perf_counter() - start) * 1000)
