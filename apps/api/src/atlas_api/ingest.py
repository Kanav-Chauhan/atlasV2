"""Read, split, embed, store. Heavy (Docling, torch, FastEmbed): only the worker imports it."""

import os
from bisect import bisect_right
from functools import cache
from itertools import accumulate
from pathlib import Path
from typing import Any

from llama_index.core import Document as LIDocument
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.node_parser import MarkdownNodeParser, SentenceSplitter
from llama_index.core.schema import BaseNode, TextNode
from llama_index.embeddings.fastembed import FastEmbedEmbedding
from llama_index.vector_stores.postgres import PGVectorStore
from sqlalchemy import text

from atlas_api.db import CHUNKS_TABLE, sync_engine
from atlas_api.models import Document
from atlas_api.settings import settings

PAGE_BREAK = "<!-- atlas:page-break -->"
EMBED_MODEL = "BAAI/bge-small-en-v1.5"
# Metadata used for filtering, not meaning: keep it out of the embedded / LLM text.
HIDDEN = ["org_id", "document_id", "access", "is_public", "superseded", "effective", "page"]


@cache
def reader() -> Any:
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from llama_index.readers.docling import DoclingReader

    opts = PdfPipelineOptions(do_ocr=False, do_table_structure=True)
    converter = DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)}
    )
    return DoclingReader(
        doc_converter=converter,
        md_export_kwargs={"image_placeholder": "", "page_break_placeholder": PAGE_BREAK},
    )


@cache
def store() -> PGVectorStore:
    return PGVectorStore(
        connection_string=settings.sync_database_url,
        async_connection_string=settings.database_url,
        table_name="chunks",  # PGVectorStore stores it as data_chunks
        embed_dim=384,
        hybrid_search=True,
        text_search_config="english",
        use_jsonb=True,
        # HNSW approximate-nearest-neighbour index, cosine distance (created with the table).
        hnsw_kwargs={
            "hnsw_m": 16,
            "hnsw_ef_construction": 64,
            "hnsw_ef_search": 40,
            "hnsw_dist_method": "vector_cosine_ops",
        },
    )


@cache
def embed_model() -> FastEmbedEmbedding:
    return FastEmbedEmbedding(
        model_name=EMBED_MODEL, cache_dir=os.path.join(settings.models_dir, "fastembed")
    )


def read_pages(path: str, fmt: str) -> list[str]:
    """Markdown text per page (one item when pages are unknown)."""
    if fmt in ("md", "txt"):
        return [Path(path).read_text(encoding="utf-8")]
    (doc,) = reader().load_data(path)
    return list(doc.text.split(PAGE_BREAK))


def chunk(doc: Document, pages: list[str]) -> list[BaseNode]:
    """Split the whole document (headings carry across pages); tag each chunk with its page."""
    text = "\n\n".join(pages)
    starts = list(accumulate((len(p) + 2 for p in pages[:-1]), initial=0))
    meta = {
        "org_id": doc.org_id,
        "access": doc.access,
        "is_public": doc.is_public,
        "title": doc.title,
        "doc_no": doc.doc_no or "",
        "superseded": doc.superseded_by is not None,
        "effective": doc.effective or "",  # shown to the answer model, not embedded
    }
    source = LIDocument(
        id_=str(doc.id),  # LlamaIndex writes this into node metadata as document_id / ref_doc_id
        text=text,
        metadata=meta,
        excluded_embed_metadata_keys=HIDDEN,
        excluded_llm_metadata_keys=HIDDEN,
    )
    splitter = SentenceSplitter(chunk_size=512, chunk_overlap=64)
    nodes: list[BaseNode] = []
    pos = 0
    # Per section, so each chunk's offset (section start + offset in section) gives its page.
    for section in MarkdownNodeParser().get_nodes_from_documents([source]):
        body = section.get_content().strip()
        if not body or (body.startswith("#") and "\n" not in body):
            continue  # a bare heading: it reaches the next chunks through their path or title
        # header_path lists the parent headings only; add this section's own heading.
        if body.startswith("#"):
            heading = body.split("\n", 1)[0].lstrip("#").strip()
            section.metadata["header_path"] += heading + "/"
        for node in splitter([section]):
            if (
                isinstance(node, TextNode)
                and isinstance(section, TextNode)
                and None not in (section.start_char_idx, node.start_char_idx)
            ):
                pos = section.start_char_idx + node.start_char_idx  # type: ignore[operator]
            if doc.format == "pdf":
                node.metadata["page"] = bisect_right(starts, pos)
            nodes.append(node)
    return nodes


def delete_chunks(document_id: int) -> None:
    with sync_engine.begin() as conn:
        conn.execute(
            text(f"DELETE FROM {CHUNKS_TABLE} WHERE metadata_->>'document_id' = :id"),
            {"id": str(document_id)},
        )


def ingest(doc: Document) -> tuple[int | None, int]:
    """Replace the document's chunks: write the new ones first, then drop the old ones,
    so a failure never leaves the document without chunks. Returns (pages, chunks)."""
    pages = read_pages(doc.file_path, doc.format)
    nodes = IngestionPipeline(transformations=[embed_model()], vector_store=store()).run(
        nodes=chunk(doc, pages)
    )
    with sync_engine.begin() as conn:
        conn.execute(
            text(
                f"DELETE FROM {CHUNKS_TABLE} WHERE metadata_->>'document_id' = :id"
                " AND node_id <> ALL(:keep)"
            ),
            {"id": str(doc.id), "keep": [n.node_id for n in nodes]},
        )
    return (len(pages) if doc.format == "pdf" else None), len(nodes)
