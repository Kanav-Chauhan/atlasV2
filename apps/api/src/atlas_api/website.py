"""Website chat settings and the public-route checks (Phase 8, docs/API.md).

Settings live in organizations.website_chat (jsonb); `config()` fills in the defaults, so an
org without a row value behaves as "disabled, no key".
"""

import secrets
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlsplit

from atlas_api.models import Organization
from atlas_api.settings import settings

DEMO_SLUGS = ("nimbus", "sanjeevani", "kaveri")
DEFAULTS: dict[str, Any] = {
    "enabled": False,
    "site_key": "",
    "allowed_origins": [],
    "greeting": "",  # "" = "Hi! Ask me anything about <company>."
    "accent": "#2563eb",
    "position": "right",
    "show_badge": True,  # stays true until Pro (Phase 10)
}


def config(org: Organization) -> dict[str, Any]:
    return DEFAULTS | (org.website_chat or {})


def greeting(org: Organization) -> str:
    return config(org)["greeting"] or f"Hi! Ask me anything about {org.name.rstrip('.')}."


def new_key() -> str:
    return secrets.token_urlsafe(16)


def demo_config() -> dict[str, Any]:
    """What seed.py gives a demo company that has no site key yet."""
    return {"enabled": True, "site_key": new_key(), "allowed_origins": [settings.app_origin]}


def normalize_origin(value: str) -> str | None:
    """'https://Shop.example.com/' → 'https://shop.example.com'; None if not an origin."""
    parts = urlsplit(value.strip())
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return None
    if parts.path not in ("", "/") or parts.query or parts.fragment or parts.username:
        return None
    port = f":{parts.port}" if parts.port else ""
    return f"{parts.scheme}://{parts.hostname.lower()}{port}"


def request_origin(origin: str | None, referer: str | None) -> str | None:
    """The calling page's origin: the Origin header, else the Referer's origin."""
    if origin and origin != "null":
        return normalize_origin(origin)
    if referer:
        parts = urlsplit(referer)
        if parts.scheme and parts.netloc:
            return normalize_origin(f"{parts.scheme}://{parts.netloc}")
    return None


def client_ip(headers: Mapping[str, str], peer: str | None) -> str:
    """The visitor's IP for rate limits. Our chain is Caddy -> Next -> API: Caddy drops any
    X-Forwarded-For the client sent and writes the real IP (it has no trusted proxies), Next
    passes it on. So the LAST hop is the one our own proxy wrote; earlier values could only
    come from the client. X-Real-IP is NOT used: Caddy doesn't set it, so it passes through
    whatever the client sent."""
    hops = [h.strip() for h in headers.get("x-forwarded-for", "").split(",") if h.strip()]
    return hops[-1] if hops else (peer or "?")


def allowed(org: Organization, origin: str | None) -> bool:
    if origin is None:
        return False
    ok = {settings.app_origin, *config(org)["allowed_origins"]}
    return origin in ok
