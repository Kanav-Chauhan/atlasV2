"""Register demo_corpus/build/<org>/* as documents and queue ingestion. Skips known files."""

import argparse
from pathlib import Path

from sqlalchemy import select

from atlas_api import uploads
from atlas_api.db import SyncSession
from atlas_api.models import EVERYONE, Document, Organization
from atlas_api.settings import settings


def front_matter(path: Path) -> dict[str, str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0] != "---":
        return {}
    meta = {}
    for line in lines[1 : lines.index("---", 1)]:
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip()
    return meta


def load(org: Organization) -> list[int]:
    from atlas_api.worker import ingest_document

    corpus = Path(settings.corpus_dir)
    queued = []
    with SyncSession() as s:
        for f in sorted((corpus / "build" / org.slug).iterdir()):
            fm = front_matter(corpus / "source" / org.slug / f"{f.stem}.md")
            digest = uploads.sha256(f.read_bytes())
            exists = s.scalar(
                select(Document.id).where(Document.org_id == org.id, Document.sha256 == digest)
            )
            if exists:
                continue
            public = fm.get("public") == "yes"
            doc = Document(
                org_id=org.id,
                title=fm.get("title", f.stem),
                doc_no=fm.get("doc_no"),
                access=EVERYONE if public else fm.get("access", EVERYONE),
                is_public=public,
                format=f.suffix.lstrip("."),
                file_path=str(f),
                sha256=digest,
                version=fm.get("version"),
                effective=fm.get("effective"),
                superseded_by=fm.get("superseded_by"),
                meta={k: fm[k] for k in ("classification", "department", "review") if k in fm},
            )
            s.add(doc)
            s.commit()
            ingest_document.delay(doc.id)
            queued.append(doc.id)
    return queued


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--org", help="org slug (default: all)")
    args = p.parse_args()
    with SyncSession() as s:
        q = select(Organization)
        if args.org:
            q = q.where(Organization.slug == args.org)
        orgs = list(s.scalars(q))
    if not orgs:
        raise SystemExit("No such organization. Run the seed script first.")
    for org in orgs:
        print(f"{org.slug}: queued {len(load(org))} documents")


if __name__ == "__main__":
    main()
