"""Sample question history for the demo companies, so the Insights charts have a shape to show.

Each sample turn is a Chat with origin SAMPLE: Insights counts it and says so; History, Home's
recent chats and the owner's usage numbers leave it out. Questions, askers and documents are the
demo exam's (demo_corpus/sample_history/<slug>.json), so an asker never appears to have read a
document they cannot open. Demo companies only; refilled by every demo reset.

    docker compose exec api python -m atlas_api.sample_history      # fill all three now
"""

import json
import random
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from atlas_api import website
from atlas_api.db import SyncSession
from atlas_api.graph import NOT_FOUND
from atlas_api.models import Chat, Document, Message, Organization, User
from atlas_api.settings import settings

SAMPLE = "sample"
DAYS = 60  # two 30-day periods, so the change figures are filled too


def fill(s: Session, org: Organization, now: datetime | None = None) -> int:
    """Replace this demo company's sample history; returns the number of sample questions."""
    if org.slug not in website.DEMO_SLUGS:
        raise ValueError(f"{org.slug} is not a demo company")
    path = Path(settings.corpus_dir, "sample_history", f"{org.slug}.json")
    s.execute(delete(Chat).where(Chat.org_id == org.id, Chat.origin == SAMPLE))
    if not path.is_file():
        return 0
    people = {u.email: u.id for u in s.scalars(select(User).where(User.org_id == org.id))}
    docs = {d.title: d.id for d in s.scalars(select(Document).where(Document.org_id == org.id))}
    items: list[dict[str, Any]] = [
        x
        for x in json.loads(path.read_text())
        if x["as"] in people and (x["doc"] is None or x["doc"] in docs)
    ]
    found = [x for x in items if x["doc"]]
    missing = [x for x in items if not x["doc"]]
    if not found:
        return 0
    rng = random.Random(org.slug)  # the same shape after every reset
    rng.shuffle(found)
    weights = [1 / (i + 3) for i in range(len(found))]  # a few questions are asked often
    now = now or datetime.now(UTC)
    n = 0
    for back in range(DAYS, 0, -1):
        day = now - timedelta(days=back)
        busy = 2 if day.weekday() >= 5 else 7 + (DAYS - back) // 15  # quiet weekends, slow growth
        for _ in range(rng.randint(max(0, busy - 2), busy + 2)):
            miss = bool(missing) and rng.random() < 0.09
            x = rng.choice(missing) if miss else rng.choices(found, weights)[0]
            at = day.replace(hour=rng.randint(4, 12), minute=rng.randint(0, 59))  # 09:30-18:30 IST
            if at >= now:
                continue
            ms = int(rng.gauss(3400, 900))
            chat = Chat(
                id=uuid.uuid4().hex,
                user_id=people[x["as"]],
                org_id=org.id,
                title=x["q"][:120],
                origin=SAMPLE,
                created_at=at,
                updated_at=at,
            )
            s.add(chat)
            s.flush()
            s.add(
                Message(
                    id=uuid.uuid4().hex, chat_id=chat.id, role="user", text=x["q"], created_at=at
                )
            )
            s.add(
                Message(
                    id=uuid.uuid4().hex,
                    chat_id=chat.id,
                    role="assistant",
                    text=NOT_FOUND if miss else x["answer"],
                    route="rag",
                    abstained=miss,
                    sources=[] if miss else [{"document_id": docs[x["doc"]], "title": x["doc"]}],
                    language="en",
                    latency_ms=max(1200, ms),
                    feedback=None
                    if miss or rng.random() > 0.25
                    else rng.choice(["up"] * 8 + ["down"]),
                    created_at=at + timedelta(milliseconds=max(1200, ms)),
                )
            )
            n += 1
    return n


if __name__ == "__main__":
    with SyncSession() as session:
        for o in session.scalars(
            select(Organization).where(Organization.slug.in_(website.DEMO_SLUGS))
        ):
            print(o.slug, fill(session, o))
        session.commit()
