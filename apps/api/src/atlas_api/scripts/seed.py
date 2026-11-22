"""Create orgs, departments and users from demo_corpus/orgs/*.json. Safe to re-run."""

import json
from datetime import date
from pathlib import Path
from typing import Any, cast

from sqlalchemy import select
from sqlalchemy.orm import Session

from atlas_api.db import SyncSession
from atlas_api.models import Department, Organization, Role, User
from atlas_api.settings import settings


def upsert(s: Session, model: Any, where: dict[str, Any], **values: Any) -> Any:
    row = s.scalar(select(model).filter_by(**where))
    if row is None:
        row = model(**where)
        s.add(row)
    for k, v in values.items():
        setattr(row, k, v)
    s.flush()
    return row


def seed_org(s: Session, data: dict[str, Any]) -> Organization:
    org = upsert(
        s,
        Organization,
        {"slug": data["slug"]},
        name=data["name"],
        industry=data.get("industry", ""),
    )
    depts = {
        d["name"]: upsert(
            s,
            Department,
            {"org_id": org.id, "name": d["name"]},
            description=d.get("description", ""),
        )
        for d in data["departments"]
    }
    for u in data["users"]:
        until = u.get("guest_until")
        upsert(
            s,
            User,
            {"email": u["email"]},
            org_id=org.id,
            name=u["name"],
            title=u.get("title", ""),
            role=Role(u["role"]),
            guest_until=date.fromisoformat(until) if until else None,
            departments=[depts[d] for d in u["departments"]],
        )
    return cast(Organization, org)


def main() -> None:
    files = sorted(Path(settings.corpus_dir, "orgs").glob("*.json"))
    with SyncSession() as s:
        for f in files:
            org = seed_org(s, json.loads(f.read_text()))
            print(f"seeded {org.slug}")
        s.commit()


if __name__ == "__main__":
    main()
