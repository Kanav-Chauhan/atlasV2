"""Querying: vector + keyword search (each top 20, permission pre-filter inside the SQL),
Reciprocal Rank Fusion, then a local cross-encoder reranks the fused top 20 down to 5."""

import os
import time
from dataclasses import dataclass, field
from functools import cache
from typing import Any

from fastembed.rerank.cross_encoder import TextCrossEncoder
from llama_index.core import VectorStoreIndex
from llama_index.core.llms import MockLLM
from llama_index.core.postprocessor.types import BaseNodePostprocessor
from llama_index.core.retrievers import BaseRetriever, QueryFusionRetriever
from llama_index.core.schema import MetadataMode, NodeWithScore, QueryBundle
from llama_index.core.vector_stores import MetadataFilters

from atlas_api.ingest import embed_model, store
from atlas_api.settings import settings

TOP_K = 20
FINAL_K = 5
# Cross-encoder logits; the old Atlas used the same value with the same model family.
SUPERSEDED_PENALTY = 3.0
MODES = ("vector", "keyword", "hybrid", "hybrid_rerank")


@cache
def index() -> VectorStoreIndex:
    return VectorStoreIndex.from_vector_store(store(), embed_model=embed_model())


@cache
def cross_encoder() -> TextCrossEncoder:
    return TextCrossEncoder(
        settings.reranker_model, cache_dir=os.path.join(settings.models_dir, "fastembed")
    )


def names_document(q: str, meta: dict[str, Any]) -> bool:
    q = q.casefold()
    return any(v and str(v).casefold() in q for v in (meta.get("title"), meta.get("doc_no")))


def penalty(q: str, meta: dict[str, Any]) -> float:
    """Superseded documents rank lower, unless the question names them."""
    return SUPERSEDED_PENALTY if meta.get("superseded") and not names_document(q, meta) else 0.0


class CrossEncoderRerank(BaseNodePostprocessor):
    """FastEmbed (ONNX) cross-encoder as a LlamaIndex node postprocessor."""

    top_n: int = FINAL_K

    def _postprocess_nodes(
        self, nodes: list[NodeWithScore], query_bundle: QueryBundle | None = None
    ) -> list[NodeWithScore]:
        if not nodes or query_bundle is None:
            return nodes[: self.top_n]
        q = query_bundle.query_str
        # Title, doc number and section path go in too: the same text the embedding saw.
        texts = [n.node.get_content(metadata_mode=MetadataMode.EMBED) for n in nodes]
        scores = cross_encoder().rerank(q, texts, batch_size=4)  # small batches keep RAM flat
        out = [
            NodeWithScore(node=n.node, score=float(s) - penalty(q, n.node.metadata))
            for n, s in zip(nodes, scores, strict=True)
        ]
        return sorted(out, key=lambda n: n.score or 0.0, reverse=True)[: self.top_n]


class Recorded(BaseRetriever):
    """Keeps a copy of a retriever's list and its time (RRF overwrites scores in place)."""

    def __init__(self, inner: BaseRetriever) -> None:
        super().__init__()
        self.inner = inner
        self.hits: list[NodeWithScore] = []
        self.ms = 0.0

    def _retrieve(self, query_bundle: QueryBundle) -> list[NodeWithScore]:
        start = time.perf_counter()
        hits = self.inner.retrieve(query_bundle)
        self.ms = (time.perf_counter() - start) * 1000
        self.hits = [NodeWithScore(node=h.node, score=h.score) for h in hits]
        return hits


@dataclass
class Result:
    stages: dict[str, list[NodeWithScore]] = field(default_factory=dict)
    ms: dict[str, float] = field(default_factory=dict)

    @property
    def final(self) -> list[NodeWithScore]:
        return list(self.stages.values())[-1]


def retrievers(filters: MetadataFilters) -> tuple[Recorded, Recorded]:
    vector = index().as_retriever(similarity_top_k=TOP_K, filters=filters)
    keyword = index().as_retriever(
        similarity_top_k=TOP_K,
        sparse_top_k=TOP_K,
        filters=filters,
        vector_store_query_mode="text_search",
    )
    return Recorded(vector), Recorded(keyword)


def search(
    q: str,
    filters: MetadataFilters,
    mode: str = "hybrid_rerank",
    top_k: int = FINAL_K,
    parts: tuple[Recorded, Recorded] | None = None,
) -> Result:
    """Run one mode and return every stage it went through (lists + milliseconds)."""
    vector, keyword = parts or retrievers(filters)
    bundle = QueryBundle(q)
    res = Result()
    if mode in ("vector", "keyword"):
        r = vector if mode == "vector" else keyword
        r.retrieve(bundle)
        res.stages[mode], res.ms[mode] = r.hits, r.ms
        return res
    fusion = QueryFusionRetriever(
        [vector, keyword],
        llm=MockLLM(),  # num_queries=1: no query generation, so the LLM is never called
        mode="reciprocal_rerank",  # type: ignore[arg-type]
        num_queries=1,
        use_async=False,
        similarity_top_k=TOP_K,
    )
    start = time.perf_counter()
    fused = fusion.retrieve(bundle)
    total = (time.perf_counter() - start) * 1000
    res.stages |= {"vector": vector.hits, "keyword": keyword.hits, "fused": fused}
    res.ms |= {"vector": vector.ms, "keyword": keyword.ms, "fusion": total - vector.ms - keyword.ms}
    if mode == "hybrid_rerank":
        start = time.perf_counter()
        res.stages["reranked"] = CrossEncoderRerank(top_n=top_k).postprocess_nodes(fused, bundle)
        res.ms["rerank"] = (time.perf_counter() - start) * 1000
    return res
