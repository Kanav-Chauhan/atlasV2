"""Prometheus metrics (Phase 11 monitoring, infra/monitoring/).

Served on their own port (settings.metrics_port, 9464 in the api container), never on the
public API: Next.js forwards /api/* to the API, so a /metrics route there would be public.
Labels are bounded: the route TEMPLATE (/documents/{doc_id}), never the raw path.
"""

import time
from collections.abc import Awaitable, Callable

from prometheus_client import Counter, Histogram, start_http_server
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Match

REQUESTS = Counter("atlas_http_requests_total", "HTTP requests", ["method", "route", "status"])
LATENCY = Histogram(
    "atlas_http_request_duration_seconds",
    "HTTP request time until the response starts (streams: until the first byte)",
    ["method", "route"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30),
)
ANSWERS = Counter(
    "atlas_answers_total",
    "Finished chat turns by who asked and how they ended",
    ["who", "outcome"],  # who: staff | visitor; outcome: answered | not_found | cached | other
)
ANSWER_SECONDS = Histogram(
    "atlas_answer_duration_seconds",
    "Whole chat turn, question to last token",
    ["who"],
    buckets=(1, 2, 4, 6, 8, 10, 15, 20, 30, 60),
)
ANSWER_ERRORS = Counter("atlas_answer_errors_total", "Chat turns that failed", ["who"])

_started = False


def serve(port: int) -> None:
    """Start the metrics HTTP server once per process (0 = off)."""
    global _started
    if port and not _started:
        start_http_server(port)
        _started = True


def route_of(request: Request) -> str:
    for route in request.app.router.routes:
        match, _ = route.matches(request.scope)
        if match == Match.FULL:
            return str(getattr(route, "path", "other"))
    return "unmatched"


async def middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    start = time.perf_counter()
    route = route_of(request)
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        LATENCY.labels(request.method, route).observe(time.perf_counter() - start)
        REQUESTS.labels(request.method, route, str(status)).inc()


def answer(who: str, route: str, abstained: bool, cached: bool, ms: int) -> None:
    if cached:
        outcome = "cached"
    elif abstained:
        outcome = "not_found"
    elif route == "rag":
        outcome = "answered"
    else:
        outcome = "other"  # smalltalk, off-topic, blocked
    ANSWERS.labels(who, outcome).inc()
    ANSWER_SECONDS.labels(who).observe(ms / 1000)
