"""Today's date for the models, and which words depend on it.

The models don't know the date. Every prompt that reads a question gets `today_line()`, so
"tomorrow" or "the same date next month" becomes a real date in the standalone question. That
date then stays in the chat memory, so a later "and the month after?" still works, even on
another day. Days are India time, like Insights."""

import calendar
import re
from datetime import date, datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30), "Asia/Kolkata")


def today() -> date:
    return datetime.now(IST).date()


def next_month(d: date) -> date:
    """The same day next month (31 Jan -> 28/29 Feb)."""
    y, m = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def say(d: date) -> str:
    return f"{d:%A} {d.day} {d:%B %Y}"


def today_line(d: date | None = None) -> str:
    """The date arithmetic is done here, not by the model."""
    d = d or today()
    tomorrow = d + timedelta(days=1)
    return (
        f"Today is {say(d)}; yesterday was {say(d - timedelta(days=1))}; tomorrow is "
        f"{say(tomorrow)}. One month from today is {say(next_month(d))}; one month from "
        f"tomorrow is {say(next_month(tomorrow))}."
    )


# "what about next month", "tom", "aaj", "कल": the answer depends on the day it is asked.
RELATIVE = re.compile(
    r"\b(today|tonight|tom|tmrw|tmw|tomm?orr?ow|yesterday|now|currently|upcoming|aaj|kal|parso|parson"
    r"|(this|next|last|previous|coming|following)\s+(day|date|week|weekend|month|quarter|year"
    r"|mon|tues?|wed(nes)?|thu(rs)?|fri|sat(ur)?|sun|monday|tuesday|wednesday|thursday|friday"
    r"|saturday|sunday|january|february|march|april|may|june|july|august|september|october"
    r"|november|december|holiday)"
    r"|(agle|agla|pichle|is)\s+(mahine|hafte|saal|din)|\d+\s+(days?|weeks?|months?)\s+(from|ago))\b"
    r"|आज|कल|परसों|अगले|पिछले",
    re.I,
)


def relative(text: str) -> bool:
    return bool(RELATIVE.search(text))


_FACTS = re.compile(
    r"\d+|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?"
    r"|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|monday|tuesday|wednesday"
    r"|thursday|friday|saturday|sunday)\b",
    re.I,
)


def facts(text: str) -> list[str]:
    """Numbers, months and weekdays in a question. Two questions that differ here are different
    questions, however close their embeddings are (25 vs 26 December, L4 vs L5)."""
    return sorted(m.lower()[:3] if m[0].isalpha() else m for m in _FACTS.findall(text))
