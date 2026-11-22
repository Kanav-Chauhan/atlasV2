"""LangSmith tracing (Phase 6). LangChain and LangGraph trace by themselves when the standard
env vars are set (settings.langsmith_tracing decides; off without a key). This module only
names each chat turn's root run so its id and URL can go into the `data-meta` part."""

import asyncio
import logging
import os
import uuid
from functools import cache
from typing import Any

from atlas_api import settings as settings_module

log = logging.getLogger(__name__)


def enabled() -> bool:
    return settings_module.tracing


def run_config(kind: str, org: str) -> dict[str, Any]:
    """Extra LangGraph config for one turn: a fixed root run id (= the LangSmith trace id)."""
    if not enabled():
        return {}
    return {
        "run_id": uuid.uuid4(),
        "run_name": f"atlas-{kind}",
        "tags": [kind],
        "metadata": {"org": org, "kind": kind},
    }


@cache
def _base_url() -> str | None:
    """https://smith.langchain.com/o/<tenant>/projects/p/<project>, looked up once."""
    from langsmith import Client

    client = Client()
    project = client.read_project(project_name=os.environ.get("LANGSMITH_PROJECT", "atlas-v2"))
    host = getattr(client, "_host_url", "https://smith.langchain.com")
    return f"{host}/o/{project.tenant_id}/projects/p/{project.id}"


async def trace_meta(config: dict[str, Any]) -> dict[str, str]:
    """{"trace_id", "trace_url"} for the data-meta part; {} when tracing is off."""
    run_id = config.get("run_id")
    if run_id is None:
        return {}
    out = {"trace_id": str(run_id)}
    try:
        base = await asyncio.wait_for(asyncio.to_thread(_base_url), timeout=3)
    except Exception:  # the project appears after its first trace; try again next turn
        _base_url.cache_clear()
        log.info("LangSmith project URL not available yet")
        return out
    if base:
        out["trace_url"] = f"{base}/r/{run_id}?trace_id={run_id}"
    return out
