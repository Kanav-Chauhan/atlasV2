"""Vercel AI SDK UI message stream (protocol v1): SSE frames `data: {json}\\n\\n`, ending with
`data: [DONE]`. Parts used: start, data-status (transient), text-start / text-delta / text-end,
data-sources, data-meta, error, finish (docs/API.md, Phase 5)."""

import json
from collections.abc import AsyncIterator
from typing import Any

HEADERS = {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    "connection": "keep-alive",
    "x-vercel-ai-ui-message-stream": "v1",
    "x-accel-buffering": "no",
}


def sse(part: dict[str, Any] | str) -> str:
    body = part if isinstance(part, str) else json.dumps(part, ensure_ascii=False)
    return f"data: {body}\n\n"


DONE = sse("[DONE]")


async def ui_parts(
    events: AsyncIterator[dict[str, Any]], message_id: str
) -> AsyncIterator[dict[str, Any]]:
    """Graph writer events ({"status"} / {"text"}) → UI message parts, in protocol order.
    The caller sends data-sources, data-meta and finish once the graph is done."""
    yield {"type": "start", "messageId": message_id}
    text_id = f"{message_id}-text"
    open_text = False
    async for ev in events:
        if "status" in ev:
            yield {"type": "data-status", "data": {"stage": ev["status"]}, "transient": True}
        elif ev.get("text"):
            if not open_text:
                yield {"type": "text-start", "id": text_id}
                open_text = True
            yield {"type": "text-delta", "id": text_id, "delta": ev["text"]}
    if open_text:
        yield {"type": "text-end", "id": text_id}
