"""Read, split, embed, store. Heavy (Docling, torch, FastEmbed): only the worker imports it."""

import os
from functools import cache
from pathlib import Path
from typing import Any

from llama_index.core import Document as LIDocument
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.node_parser import MarkdownNodeParser, SentenceSplitter
from llama_index.embeddings.fastembed import FastEmbedEmbedding
from llama_index.vector_stores.postgres import PGVectorStore
from sqlalchemy import text

from atlas_api.db import CHUNKS_TABLE, sync_engine
from atlas_api.models import Document
from atlas_api.settings import settings

PAGE_BREAK = "<!-- atlas:page-break -->"
EMBED_MODEL = "BAAI/bge-small-en-v1.5"
# Metadata used for filtering, not meaning: keep it out of the embedded / LLM text.
HIDDEN = ["org_id", "document_id", "access", "is_public", "superseded", "page"]


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
def pipeline() -> IngestionPipeline:
    store = PGVectorStore(
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
    embed = FastEmbedEmbedding(
        model_name=EMBED_MODEL, cache_dir=os.path.join(settings.models_dir, "fastembed")
    )
    return IngestionPipeline(
        transformations=[
            MarkdownNodeParser(),
            SentenceSplitter(chunk_size=512, chunk_overlap=64),
            embed,
        ],
        vector_store=store,
    )


def read_pages(path: str, fmt: str) -> list[str]:
    """Markdown text per page (one item when pages are unknown)."""
    if fmt in ("md", "txt"):
        return [Path(path).read_text(encoding="utf-8")]
    (doc,) = reader().load_data(path)
    return list(doc.text.split(PAGE_BREAK))


def delete_chunks(document_id: int) -> None:
    with sync_engine.begin() as conn:
        if conn.scalar(text(f"SELECT to_regclass('{CHUNKS_TABLE}')")):
            conn.execute(
                text(f"DELETE FROM {CHUNKS_TABLE} WHERE metadata_->>'document_id' = :id"),
                {"id": str(document_id)},
            )


def ingest(doc: Document) -> tuple[int | None, int]:
    """Replace the document's chunks. Returns (pages, chunks)."""
    texts = read_pages(doc.file_path, doc.format)
    paged = doc.format == "pdf"
    base = {
        "org_id": doc.org_id,
        "access": doc.access,
        "is_public": doc.is_public,
        "title": doc.title,
        "doc_no": doc.doc_no or "",
        "superseded": doc.superseded_by is not None,
    }
    docs = [
        LIDocument(
            # LlamaIndex writes this id into node metadata as document_id / ref_doc_id.
            id_=str(doc.id),
            text=t,
            metadata=base | ({"page": n} if paged else {}),
            excluded_embed_metadata_keys=HIDDEN,
            excluded_llm_metadata_keys=HIDDEN,
        )
        for n, t in enumerate(texts, 1)
        if t.strip()
    ]
    delete_chunks(doc.id)
    nodes = pipeline().run(documents=docs)
    return (len(texts) if paged else None), len(nodes)
