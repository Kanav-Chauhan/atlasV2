"""Semantic answer cache (RedisVL SemanticCache on Redis), permission-safe.

Every entry is tagged with an access scope = org + role + sorted departments + answer language,
and a lookup only searches entries with the asker's exact scope: two people who can open
different documents never share an answer. The key text is the rewritten English question,
embedded with the same bge-small model as the chunks. Questions that needed chat history
to rewrite are never cached (their meaning depends on the thread).

Invalidation: every entry's scope tag also carries the company's cache generation (a Redis
counter). Anything that changes what a company's documents say or who may read them (upload
finished, delete, public on/off, department rename, demo reset) bumps the counter, so all of
that company's earlier answers stop matching at once; they expire on their TTL.
"""

import asyncio
import hashlib
import json
from typing import Any

import redis
from llama_index.core.base.embeddings.base import BaseEmbedding

from atlas_api import when
from atlas_api.db import redis as aredis
from atlas_api.models import Role
from atlas_api.settings import settings


def scope(org_id: int, role: Role | str, departments: set[str] | list[str], language: str) -> str:
    # An admin sees every document in the org, so departments don't matter for them.
    depts = "*" if role == Role.admin else ",".join(sorted(departments))
    raw = f"{org_id}|{role}|{depts}|{language}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def visitor_scope(org_id: int, language: str) -> str:
    """Website visitors of one company share answers only with each other (Phase 8)."""
    raw = f"visitor|{org_id}|{language}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def gen_key(org_id: int) -> str:
    return f"atlas:cache:gen:{org_id}"


async def invalidate(org_id: int) -> None:
    """Drop every cached answer of this company (async callers: the api)."""
    if not settings.semantic_cache:
        return
    await aredis.incr(gen_key(org_id))


def invalidate_sync(org_id: int) -> None:
    """Same, for the sync Celery worker (ingest finished, demo reset)."""
    if not settings.semantic_cache:
        return
    with redis.Redis.from_url(settings.redis_url) as r:
        r.incr(gen_key(org_id))


async def _tag(org_id: int, scope_key: str) -> str:
    gen = int(await aredis.get(gen_key(org_id)) or 0)
    return f"{scope_key}g{gen}"


def _embedder() -> BaseEmbedding:
    """The retrieval index's bge-small instance: one copy of the model in RAM."""
    from atlas_api import retrieve

    return retrieve.index()._embed_model


class AnswerCache:
    """Thin async wrapper; the RedisVL index is created on first use."""

    def __init__(self) -> None:
        self._cache: Any = None
        self._lock = asyncio.Lock()

    async def _get(self) -> Any:
        async with self._lock:
            if self._cache is None:
                self._cache = await asyncio.to_thread(self._make)
            return self._cache

    @staticmethod
    def _make() -> Any:
        from redisvl.extensions.cache.llm import SemanticCache
        from redisvl.utils.vectorize import CustomTextVectorizer

        return SemanticCache(
            name="atlas_answers",
            distance_threshold=1 - settings.cache_similarity,  # cosine distance
            ttl=settings.cache_ttl_s,
            vectorizer=CustomTextVectorizer(embed=_embedder().get_query_embedding),
            filterable_fields=[{"name": "scope", "type": "tag"}],
            redis_url=settings.redis_url,
        )

    @staticmethod
    async def _vector(text: str) -> list[float]:
        return await asyncio.to_thread(_embedder().get_query_embedding, text)

    async def lookup(self, query: str, scope_key: str, org_id: int) -> dict[str, Any] | None:
        from redisvl.query.filter import Tag

        cache = await self._get()
        hits = await cache.acheck(
            vector=await self._vector(query),
            filter_expression=Tag("scope") == await _tag(org_id, scope_key),
            num_results=1,
        )
        if not hits:
            return None
        # Close embeddings are not the same question when a number or a date differs.
        if when.facts(hits[0]["prompt"]) != when.facts(query):
            return None
        payload: dict[str, Any] = json.loads(hits[0]["response"])
        return payload

    async def store(self, query: str, scope_key: str, org_id: int, payload: dict[str, Any]) -> None:
        cache = await self._get()
        await cache.astore(
            prompt=query,
            response=json.dumps(payload),
            vector=await self._vector(query),
            filters={"scope": await _tag(org_id, scope_key)},
        )
