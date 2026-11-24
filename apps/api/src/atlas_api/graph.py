"""How a message is answered: a LangGraph StateGraph (PLAN.md §5).

guard → route → (smalltalk | offtopic | blocked | rewrite) → cache_lookup → retrieve → grade
  grade weak → rewrite once with a different formulation → retrieve → grade
  → answer | not_found → cite_check → cache_store

grade (corrective RAG, Phase 6) has two checks: the cross-encoder's top score against a
calibrated threshold, then the `fast` model's relevance verdict (yes / partial / no). It is a
gate: on yes/partial every passage reaches the answer model.

Speed (2026-11-23): the answer model starts in `grade`, concurrently with the relevance check
(AnswerDraft below), and `answer` releases its buffered tokens only once the gate said yes;
"no" cancels it. route, rewrite and the relevance check each have a time limit
(settings.*_timeout_s) with a safe default when the model is slow.

The semantic cache sits after rewrite because its key is the rewritten English question.
Nodes stream to the client through the runtime stream writer: {"status": stage} and
{"text": delta}. The chat history lives in the LangGraph checkpointer (thread = user + chat).
"""

import asyncio
import logging
import re
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import AIMessage, AnyMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.runtime import Runtime
from langgraph.types import Checkpointer
from llama_index.core.schema import NodeWithScore
from llama_index.core.vector_stores import MetadataFilters

from atlas_api import citations, guard, when
from atlas_api.cache import AnswerCache
from atlas_api.llm import Models, history_text, last_standalone
from atlas_api.settings import settings

log = logging.getLogger(__name__)

NOT_FOUND = "Not found in your documents."
NOT_FOUND_REASON = {
    "en": "No document you can open answers this, so Atlas did not guess.",
    "hi": "आप जिन दस्तावेज़ों को खोल सकते हैं, उनमें से किसी में इसका जवाब नहीं है, "
    "इसलिए Atlas ने अनुमान नहीं लगाया।",
}
# Both answer tries came back empty (answer_node).
TRY_AGAIN = {
    "en": "Sorry, I couldn't write an answer just now. Please try again in a moment.",
    "hi": "माफ़ कीजिए, अभी जवाब नहीं बन पाया। कृपया थोड़ी देर में फिर से पूछिए।",
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
    lookup: str  # "holiday calendar 2026": what to search for a one-day question, "" otherwise
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
    timeouts: list[str]  # model steps that ran out of time this turn (route, rewrite, grade, …)


def new_turn(question: str) -> State:
    """Graph input for one message: resets every per-turn field, appends the question."""
    return State(
        messages=[HumanMessage(question)],
        question=question,
        route="",
        smalltalk="",
        language="en",
        query="",
        lookup="",
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
        timeouts=[],
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
    org_id: int = 0  # the cache's invalidation counter is per company (cache.invalidate)
    # Website visitor (Phase 8): public documents only, no suggestions, website wording.
    visitor: bool = False
    greeting: str = ""
    # LLM relevance grade after the score threshold (ATLAS_RELEVANCE_GRADE).
    relevance: bool = field(default_factory=lambda: settings.relevance_grade)
    # Time limits in seconds (settings.*_timeout_s; tests shorten them).
    grade_timeout: float = field(default_factory=lambda: settings.grade_timeout_s)
    route_timeout: float = field(default_factory=lambda: settings.route_timeout_s)
    rewrite_timeout: float = field(default_factory=lambda: settings.rewrite_timeout_s)
    # The answer started early by `grade` and handed to `answer` (never checkpointed: a live
    # asyncio task belongs to this request only).
    draft: "AnswerDraft | None" = None


class AnswerDraft:
    """The answer model's stream, started before the relevance gate has decided.

    Why: the relevance check and the answer both wait on the gateway (median 3.4 s and 4.9 s,
    p90 17 s and 12 s). Run one after the other they add up; started together the answer is
    usually ready, or well under way, when the gate opens. A background task pulls the model's
    deltas into a queue; nothing reaches the user until `answer_node` drains it, which it does
    only when the gate said yes/partial (or timed out with a passing score). On "no" the task
    is cancelled, so the gate still decides exactly as before: the cost is only the tokens of
    an answer that was thrown away (questions that end in "not found").
    `key` ties the draft to the query + passages it was written for; `answer_node` never uses
    a draft for anything else.
    """

    def __init__(self, key: tuple[str, ...], stream: AsyncIterator[str]) -> None:
        self.key = key
        self._queue: asyncio.Queue[str | Exception | None] = asyncio.Queue()
        self._task = asyncio.create_task(self._pump(stream))

    async def _pump(self, stream: AsyncIterator[str]) -> None:
        try:
            async for delta in stream:
                self._queue.put_nowait(delta)
        except Exception as e:  # handed to the reader, raised where the answer streams
            self._queue.put_nowait(e)
        finally:
            self._queue.put_nowait(None)

    async def deltas(self) -> AsyncIterator[str]:
        while (item := await self._queue.get()) is not None:
            if isinstance(item, Exception):
                raise item
            yield item

    def cancel(self) -> None:
        self._task.cancel()


def draft_key(state: "State") -> tuple[str, ...]:
    return (state["question"], state["query"], *(p["chunk_id"] for p in state["passages"]))


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
    # Out of time -> a document question (the normal RAG path). The router is also a second
    # safety check ("blocked" for jailbreaks the rules miss); on a timeout that check is
    # skipped, and the safety net is the rule guard (guard_node, always run first) plus the
    # answer prompt, which treats passages and question as data and answers only from
    # documents the asker can open (retrieval filters are never relaxed).
    try:
        out = await limited(
            ctx.models.route(q, ctx.org, history_text(state["messages"][:-1])), ctx.route_timeout
        )
        return {"route": out.route, "language": "hi" if lang == "hi" else out.language}
    except TimeoutError:
        log.warning(
            "router timed out after %.1fs; treating the message as a question", ctx.route_timeout
        )
        return {"route": "rag", "language": lang, "timeouts": [*state.get("timeouts", []), "route"]}
    except Exception:
        log.exception("router model failed; treating the message as a question")
        return {"route": "rag", "language": lang}


async def limited[T](call: Awaitable[T], seconds: float) -> T:
    """`call` with a time limit (TimeoutError when it runs out; the call is cancelled)."""
    return await asyncio.wait_for(call, seconds)


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


def plain_followup(question: str, history: list[AnyMessage]) -> str:
    """The search query when the rewrite step failed: a short follow-up ("what about next
    month?") means nothing alone, so the last question's standalone form goes with it."""
    before = last_standalone(history)
    return f"{before} {question}" if before and len(question.split()) <= 8 else question


def said(state: State, text: str) -> AIMessage:
    """The answer as stored in the chat, with the question it answered in standalone form
    (llm.history_text reads it back)."""
    return AIMessage(text, additional_kwargs={"query": state["first_query"] or state["query"]})


async def rewrite_node(state: State, runtime: Runtime[Ctx]) -> dict[str, Any]:
    ctx = runtime.context
    q = state["question"]
    if state.get("attempt", 0) > 0:  # corrective retry: a different formulation
        _status(runtime, "retry")
        try:
            alt = await limited(
                ctx.models.reformulate(state["query"], ctx.org), ctx.rewrite_timeout
            )
        except TimeoutError:
            log.warning("reformulate timed out; retrying with the same query")
            return {"timeouts": [*state.get("timeouts", []), "reformulate"]}
        except Exception:
            log.exception("reformulate failed")
            alt = ""
        # The meaning stays the first query (the date must not get lost); only the search changes.
        if when.names_a_day(state["query"]):
            return {"lookup": alt}
        return {"query": alt or state["query"]}
    _status(runtime, "rewrite")
    history = state["messages"][:-1]
    dated = when.relative(q)  # "tomorrow": the model must write the real date
    needs_model = bool(history) or state["language"] == "hi" or _COMPANY_WORDS.search(q) or dated
    if not needs_model:
        return {"query": q, "first_query": q, "used_history": False}
    timeouts, lookup = state.get("timeouts", []), ""
    try:
        out = await limited(
            ctx.models.rewrite(q, ctx.org, history_text(history)), ctx.rewrite_timeout
        )
        query = out.query.strip() or q
        # One day scores badly against a table of dates; the table's name finds it.
        lookup = out.lookup.strip() if when.names_a_day(query) else ""
        used = (bool(history) and out.used_history) or dated
    except TimeoutError:
        log.warning("rewrite timed out; searching with the question as asked")
        query, used = plain_followup(q, history), bool(history) or dated
        timeouts = [*timeouts, "rewrite"]
    except Exception:
        log.exception("rewrite failed; searching with the question as asked")
        query, used = plain_followup(q, history), bool(history) or dated
    # used=True = never cached: the turn leaned on the chat, or on the day it was asked, or
    # there was no clean rewrite.
    return {
        "query": query,
        "lookup": lookup,
        "first_query": query,
        "used_history": used,
        "timeouts": timeouts,
    }


def after_rewrite(state: State) -> Literal["cache_lookup", "retrieve"]:
    return "retrieve" if state.get("attempt", 0) > 0 else "cache_lookup"


async def cache_lookup_node(state: State, runtime: Runtime[Ctx]) -> dict[str, Any]:
    ctx = runtime.context
    if ctx.cache is None or state["used_history"]:
        return {}
    _status(runtime, "cache")
    try:
        hit = await ctx.cache.lookup(state["query"], ctx.scope(state["language"]), ctx.org_id)
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
        "messages": [said(state, hit["answer"])],
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
    q = state.get("lookup") or state["query"]
    hits = await asyncio.to_thread(ctx.search or default_search, q, ctx.filters)
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
    (evals/grading/run1).
    Once the score passes, the answer model starts right away (AnswerDraft, buffered) while
    the relevance check runs; the check has ctx.grade_timeout seconds, after which the score
    decides alone (the pre-Phase-6 rule, which already passed here) and the turn answers."""
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
    text = passages_text(passages)
    draft = AnswerDraft(
        draft_key(state), ctx.models.answer(state["question"], state["query"], text, ctx.org)
    )
    try:
        out = await limited(
            ctx.models.relevance(state["question"], state["query"], text, ctx.org),
            ctx.grade_timeout,
        )
    except TimeoutError:
        log.warning(
            "relevance grade timed out after %.1fs; answering on the score alone (%.2f)",
            ctx.grade_timeout,
            state["top_score"],
        )
        log_entry["verdict"] = "timeout"
        ctx.draft = draft
        timeouts = [*state.get("timeouts", []), "grade"]
        return {"grade": "answer", "relevance": "timeout", "grade_log": grade_log} | {
            "timeouts": timeouts
        }
    except asyncio.CancelledError:  # the turn itself was cancelled (client went away)
        draft.cancel()
        raise
    except Exception:
        log.exception("relevance grade failed; answering on the score alone")
        log_entry["verdict"] = "error"
        ctx.draft = draft
        return {"grade": "answer", "relevance": "error", "grade_log": grade_log}
    log_entry |= {"verdict": out.verdict, "marked": out.passages}
    if out.verdict == "no":
        draft.cancel()  # the gate is closed: the early answer is thrown away unseen
        return fail | {"relevance": "no", "grade_log": grade_log}
    ctx.draft = draft
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


async def stream_cited(
    deltas: AsyncIterator[str], passages: int, runtime: Runtime[Ctx]
) -> tuple[str, list[int]]:
    """Stream an answer through the citation check. Leading blank text is held back, so an
    answer that turns out empty sends nothing (answer_node then retries)."""
    cites = citations.Citations(passages)
    parts: list[str] = []
    held = ""  # blank text not sent yet

    def emit(out: str) -> None:
        nonlocal held
        parts.append(out)
        held += out
        if held.strip():
            _say(runtime, held)
            held = ""

    async for delta in deltas:
        if out := cites.feed(delta):
            emit(out)
    if out := cites.flush():
        emit(out)
    return "".join(parts), cites.order


async def answer_node(state: State, runtime: Runtime[Ctx]) -> dict[str, Any]:
    """Release the answer (the draft `grade` started, else a fresh call when the gate is off).
    An empty answer never reaches the user as a success: the reasoning models can spend the
    whole token budget thinking (finish_reason=length, no text: visitor answers, 2026-11-23),
    or the citation check can strip an answer that was only bad markers. Then one retry on
    the fallback models only; still empty → a "please try again" reply, marked abstained so
    it is never cached."""
    _status(runtime, "answer")
    ctx = runtime.context
    n = len(state["passages"])
    text = passages_text(state["passages"])
    draft, ctx.draft = ctx.draft, None
    if draft is not None and draft.key != draft_key(state):
        draft.cancel()
        draft = None
    deltas = (
        draft.deltas()
        if draft is not None
        else ctx.models.answer(state["question"], state["query"], text, ctx.org)
    )
    try:
        answer, order = await stream_cited(deltas, n, runtime)
    finally:
        if draft is not None:
            draft.cancel()  # no-op once finished; stops the model if this turn is cancelled
    if not answer.strip():
        log.warning("empty answer; retrying on the fallback models: %r", state["question"][:80])
        try:
            answer, order = await stream_cited(
                ctx.models.answer(state["question"], state["query"], text, ctx.org, retry=True),
                n,
                runtime,
            )
        except Exception:
            log.exception("answer retry failed")
            answer, order = "", []
    if not answer.strip():
        log.error("empty answer twice; asking the user to try again: %r", state["question"][:80])
        reply = TRY_AGAIN.get(state["language"], TRY_AGAIN["en"])
        _say(runtime, reply)
        return {"answer": reply, "cite_order": [], "abstained": True}
    return {"answer": answer, "cite_order": order}


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
    return {"sources": sources, "messages": [said(state, state["answer"])]}


async def cache_store_node(state: State, runtime: Runtime[Ctx]) -> dict[str, Any]:
    ctx = runtime.context
    if ctx.cache is None or state["used_history"] or state["abstained"] or not state["sources"]:
        return {}
    try:
        await ctx.cache.store(
            state["first_query"],
            ctx.scope(state["language"]),
            ctx.org_id,
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
