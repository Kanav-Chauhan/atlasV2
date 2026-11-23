"""Demo reset (Phase 10): puts one demo company back to its clean state.

Runs nightly (Celery beat, worker.py) and from the "Reset demo" button (POST /demo/reset).
Surgical, so it is cheap: only documents that were deleted get re-ingested.
- activity: chats + messages, chat memory (LangGraph checkpoints), document requests,
  agent tokens + their audit rows
- documents: uploads deleted (chunks, row, file); clean documents get their corpus values
  back (title, access, public flag, ...) and their chunk metadata re-synced; deleted clean
  documents are registered again and queued for ingestion
- team: people not in demo_corpus/orgs/<slug>.json deleted, the rest reset (role,
  departments); departments not in the file deleted, missing ones re-created
- settings: name, industry, description, website chat (with the fixed demo site key),
  org settings + logo, profile pictures (files under <files_dir>/<slug>/images/)
The semantic answer cache is off on p10 (settings.semantic_cache); if it is turned on, it
needs clearing here too.
"""

import json
import shutil
from collections import Counter
from pathlib import Path
from typing import Any, cast

from sqlalchemy import CursorResult, delete, select, text, update
from sqlalchemy.orm import Session

from atlas_api import cache, website
from atlas_api.db import CHUNKS_TABLE, SyncSession
from atlas_api.models import Chat, Department, Document, DocumentRequest, Organization, User
from atlas_api.scripts.load_corpus import corpus_docs
from atlas_api.scripts.seed import seed_org
from atlas_api.settings import settings
from atlas_api.tokens import ApiToken

DOC_FIELDS = (
    "title",
    "doc_no",
    "access",
    "is_public",
    "file_path",
    "version",
    "effective",
    "superseded_by",
    "meta",
)


def run(s: Session, stmt: Any, params: dict[str, Any] | None = None) -> int:
    """Execute a bulk statement; returns the number of rows it touched."""
    return int(cast(CursorResult[Any], s.execute(stmt, params)).rowcount)


def table_exists(s: Session, name: str) -> bool:
    return bool(s.scalar(text("SELECT to_regclass(:t)"), {"t": name}))


def forget_memory(s: Session, org: Organization) -> None:
    """Chat memory rows: staff threads are '<user_id>:<chat_id>', visitor threads
    'visitor:<site_key>:<thread>' (chat_routes.thread_id, website_routes)."""
    staff = [
        f"{uid}:{cid}"
        for uid, cid in s.execute(
            select(Chat.user_id, Chat.id).where(Chat.org_id == org.id, Chat.user_id.is_not(None))
        )
    ]
    key = website.config(org)["site_key"]
    for table in ("checkpoint_writes", "checkpoint_blobs", "checkpoints"):
        if not table_exists(s, table):
            continue
        if staff:
            s.execute(
                text(f"DELETE FROM {table} WHERE thread_id = ANY(:ids)"),  # noqa: S608
                {"ids": staff},
            )
        if key:
            s.execute(
                text(f"DELETE FROM {table} WHERE thread_id LIKE :p"),  # noqa: S608
                {"p": f"visitor:{key}:%"},
            )


def delete_document(s: Session, doc: Document, chunks: bool) -> None:
    if chunks:
        s.execute(
            text(f"DELETE FROM {CHUNKS_TABLE} WHERE metadata_->>'document_id' = :id"),  # noqa: S608
            {"id": str(doc.id)},
        )
    path = Path(doc.file_path)
    s.delete(doc)
    if path.is_relative_to(settings.files_dir):  # corpus files are read-only mounts
        path.unlink(missing_ok=True)


def reset_org(slug: str) -> dict[str, int]:
    """Reset one demo company; returns counts of what changed."""
    if slug not in website.DEMO_SLUGS:
        raise ValueError(f"{slug} is not a demo company")
    data = json.loads(Path(settings.corpus_dir, "orgs", f"{slug}.json").read_text())
    clean = {d["sha256"]: d for d in corpus_docs(slug)}
    out: Counter[str] = Counter()
    queue: list[int] = []
    with SyncSession() as s:
        org = s.scalar(select(Organization).where(Organization.slug == slug))
        if org is None:
            raise ValueError(f"{slug} is not seeded")
        chunks = table_exists(s, CHUNKS_TABLE)

        # activity
        forget_memory(s, org)
        out["chats"] = run(s, delete(Chat).where(Chat.org_id == org.id))
        out["requests"] = run(s, delete(DocumentRequest).where(DocumentRequest.org_id == org.id))
        out["tokens"] = run(s, delete(ApiToken).where(ApiToken.org_id == org.id))

        # documents
        seen: set[str] = set()
        for doc in s.scalars(select(Document).where(Document.org_id == org.id)):
            values = clean.get(doc.sha256)
            if values is None or doc.sha256 in seen:
                delete_document(s, doc, chunks)
                out["uploads_deleted"] += 1
                continue
            seen.add(doc.sha256)
            changed = False
            for field in DOC_FIELDS:
                if getattr(doc, field) != values[field]:
                    setattr(doc, field, values[field])
                    changed = True
            out["documents_restored"] += changed
        for sha, values in clean.items():
            if sha not in seen:
                doc = Document(org_id=org.id, **values)
                s.add(doc)
                s.flush()
                queue.append(doc.id)
        out["documents_reingested"] = len(queue)
        s.flush()
        if chunks:  # access / public flag as the documents now say (dept renames, sharing)
            out["chunks_synced"] = run(
                s,
                text(
                    f"UPDATE {CHUNKS_TABLE} c SET metadata_ = c.metadata_ || jsonb_build_object("  # noqa: S608
                    "'access', d.access, 'is_public', d.is_public) FROM documents d "
                    "WHERE d.org_id = :org AND c.metadata_->>'document_id' = d.id::text "
                    "AND (c.metadata_->>'access' IS DISTINCT FROM d.access "
                    "OR (c.metadata_->>'is_public')::boolean IS DISTINCT FROM d.is_public)"
                ),
                {"org": org.id},
            )

        # team, departments, settings
        emails = [u["email"] for u in data["users"]]
        out["people_deleted"] = run(
            s, delete(User).where(User.org_id == org.id, User.email.not_in(emails))
        )
        names = [d["name"] for d in data["departments"]]
        out["departments_deleted"] = run(
            s, delete(Department).where(Department.org_id == org.id, Department.name.not_in(names))
        )
        s.expire_all()
        seed_org(s, data)
        org.description = ""
        org.website_chat = website.demo_config(data.get("site_key"), data.get("accent"))
        org.auto_join = {}  # UI phase 5 (never used on demo orgs; kept clean anyway)
        # UI phase 8: settings (access defaults, notifications, logo) + profile pictures
        org.settings = {}
        out["avatars_cleared"] = run(
            s,
            update(User).where(User.org_id == org.id, User.avatar.is_not(None)).values(avatar=None),
        )
        shutil.rmtree(Path(settings.files_dir, slug, "images"), ignore_errors=True)
        s.commit()
        cache.invalidate_sync(org.id)  # documents, access and public flags are back to seed

    if queue:
        from atlas_api.worker import ingest_document

        for doc_id in queue:
            ingest_document.delay(doc_id)
    return {k: v for k, v in out.items() if v}
