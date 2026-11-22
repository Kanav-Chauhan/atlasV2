"""cite_check: keep only [n] markers that point at a real passage and renumber them 1, 2, 3…
in order of first use. Works on a token stream, so the text the user sees while it streams
is already the checked text (a marker split across two chunks is held back until complete).
"""

import logging
import re

log = logging.getLogger(__name__)

# [1], [1, 2] and the gpt-oss style the fallback models write: 【1】, 【1†source】, 【1†L3-L5】
_MARKER = re.compile(r"[\[【](\d{1,3}(?:\s*,\s*\d{1,3})*)(?:†[^\]】]{0,40})?[\]】]")
_PARTIAL = re.compile(r"[\[【][\d,\s]{0,16}(?:†[^\]】]{0,40})?$")  # may still be arriving


class Citations:
    def __init__(self, passages: int) -> None:
        self.passages = passages
        self.order: list[int] = []  # original passage numbers (1-based), in first-cited order
        self.dropped: list[int] = []
        self._buf = ""

    def _sub(self, m: re.Match[str]) -> str:
        out = []
        for part in m.group(1).split(","):
            n = int(part)
            if not 1 <= n <= self.passages:
                self.dropped.append(n)
                continue
            if n not in self.order:
                self.order.append(n)
            new = f"[{self.order.index(n) + 1}]"
            if new not in out:
                out.append(new)
        return "".join(out)

    def feed(self, delta: str) -> str:
        self._buf += delta
        cut = _PARTIAL.search(self._buf)
        ready, self._buf = (
            (self._buf[: cut.start()], self._buf[cut.start() :]) if cut else (self._buf, "")
        )
        return _MARKER.sub(self._sub, ready)

    def flush(self) -> str:
        rest, self._buf = self._buf, ""
        out = _MARKER.sub(self._sub, rest)
        if self.dropped:
            log.warning("cite_check removed markers with no passage: %s", self.dropped)
        return out


def check(text: str, passages: int) -> tuple[str, list[int]]:
    """Whole-text version: (checked text, original passage numbers in new order)."""
    c = Citations(passages)
    out = c.feed(text) + c.flush()
    # Removing a marker can leave "word ." or double spaces behind.
    out = re.sub(r"[ \t]+([.,;:!?])", r"\1", out)
    return re.sub(r"[ \t]{2,}", " ", out), c.order
