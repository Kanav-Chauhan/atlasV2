import logging
import time
from typing import Any

from celery import Celery
from celery.schedules import crontab

from atlas_api.db import SyncSession
from atlas_api.models import Document, Status
from atlas_api.settings import settings

app = Celery("atlas", broker=settings.redis_url, backend=settings.redis_url)
app.conf.update(
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    timezone="Asia/Kolkata",
    # The worker runs with --beat (one worker): the demo companies reset at 03:00 IST.
    beat_schedule={
        "demo-reset-nightly": {
            "task": "atlas_api.worker.reset_demo",
            "schedule": crontab(minute=0, hour=3),
        }
    },
)
log = logging.getLogger(__name__)


@app.task
def ping() -> str:
    return "pong"


@app.task
def reset_demo(slug: str | None = None) -> dict[str, dict[str, int]]:
    """Reset one demo company (the Reset demo button) or all three (nightly)."""
    from atlas_api import demo_reset, website

    out = {}
    for s in [slug] if slug else website.DEMO_SLUGS:
        out[s] = demo_reset.reset_org(s)
        log.info("demo reset %s: %s", s, out[s])
    return out


def set_status(doc_id: int, **values: object) -> Document | None:
    with SyncSession() as s:
        doc = s.get(Document, doc_id)
        if doc:
            for k, v in values.items():
                setattr(doc, k, v)
            s.commit()
        return doc


@app.task(bind=True, max_retries=2)
def ingest_document(self: Any, document_id: int) -> str:
    doc = set_status(document_id, status=Status.processing, error=None)
    if not doc:
        return "missing"
    from atlas_api.ingest import ingest  # heavy: Docling, torch, FastEmbed

    start = time.monotonic()
    try:
        pages, chunks = ingest(doc)
    except FileNotFoundError:
        set_status(document_id, status=Status.failed, error="The file is missing.")
        return "failed"
    except Exception as e:
        log.exception("ingest %s failed", document_id)
        set_status(
            document_id,
            status=Status.failed,
            error=f"Could not read this document ({type(e).__name__}). Try uploading it again.",
        )
        raise self.retry(exc=e, countdown=30 * 2**self.request.retries) from e
    set_status(document_id, status=Status.ready, pages=pages, chunks=chunks)
    log.info(
        "ingest %s: %s pages, %s chunks, %.1fs",
        document_id,
        pages,
        chunks,
        time.monotonic() - start,
    )
    return "ready"
