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


_MONTHS = [m.lower() for m in calendar.month_name[1:]]
_MON = r"jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?" + (
    r"|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"
)
_DAY = re.compile(
    rf"\b(?:(?P<d1>\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?(?P<m1>{_MON})"
    rf"|(?P<m2>{_MON})\s+(?P<d2>\d{{1,2}})(?:st|nd|rd|th)?)\b(?:,?\s*(?P<y>20\d\d)\b)?",
    re.I,
)


def _read(m: re.Match[str], now: date) -> date | None:
    month = next(
        i for i, n in enumerate(_MONTHS, 1) if n.startswith((m["m1"] or m["m2"]).lower()[:3])
    )
    day = int(m["d1"] or m["d2"])
    try:
        if m["y"]:
            return date(int(m["y"]), month, day)
        this_year = date(now.year, month, day)  # no year: the next time it comes round
        return this_year if this_year >= now else date(now.year + 1, month, day)
    except ValueError:
        return None


def find_day(text: str, now: date | None = None) -> date | None:
    m = _DAY.search(text)
    return _read(m, now or today()) if m else None


def names_a_day(text: str) -> bool:
    return find_day(text) is not None


def plain(d: date) -> str:
    return f"{d.day} {d:%B %Y}"


_WORDS = {
    r"\b(today|aaj)\b|आज": 0,
    r"\b(tmrw|tmw|tomm?orr?ow)\b": 1,
    r"\byesterday\b": -1,
    r"\bday after tomorrow\b": 2,
}


def resolve(text: str, now: date | None = None) -> str:
    """Without a model: "holiday tom" -> "holiday 25 November 2026", "26 january" gets its year."""
    now = now or today()
    # "tom" is also a name: a date only in lower case and next to a word about days off.
    if re.search(r"holiday|chh?utti|\b(office|off|open|closed|wfh|leave)\b", text, re.I):
        text = re.sub(r"\btom\b", "tomorrow", text)
    # Hindi "kal" is yesterday or tomorrow; the verb says which.
    past = re.search(r"\b(tha|thi|the|thee|hua|gaya)\b|था|थी|थे|हुआ", text, re.I)
    text = re.sub(r"\bkal\b|कल", "yesterday" if past else "tomorrow", text, flags=re.I)
    for pattern, days in reversed(_WORDS.items()):  # "day after tomorrow" before "tomorrow"
        text = re.sub(pattern, plain(now + timedelta(days=days)), text, flags=re.I)

    def full(m: re.Match[str]) -> str:
        d = _read(m, now)
        return plain(d) if d else m[0]

    return _DAY.sub(full, text)


def shift(last: str, follow_up: str, now: date | None = None) -> str:
    """The last question moved to the day a short follow-up names ("next month this date", "and
    the day after that?", "what about 26 jan?"); "" when it doesn't name one."""
    now = now or today()
    m = _DAY.search(last)
    before = _read(m, now) if m else None
    if m is None or before is None:
        return ""
    f = follow_up.lower()
    if named := find_day(resolve(follow_up, now), now):
        after = named
    elif re.search(r"\bnext month\b|agle mahine|अगले महीने", f):
        after = next_month(before)
    elif re.search(r"\b(next day|day after)\b", f):
        after = before + timedelta(days=1)
    elif re.search(r"\b(previous day|day before)\b", f):
        after = before - timedelta(days=1)
    elif re.search(r"\bnext week\b", f):
        after = before + timedelta(days=7)
    elif re.search(r"\bnext year\b", f):
        after = before.replace(year=before.year + 1, day=min(before.day, 28))
    else:
        return ""
    return last[: m.start()] + plain(after) + last[m.end() :]


def calendar_for(query: str) -> str:
    """What to search when someone asks whether one day is a holiday and the model gave nothing."""
    d = find_day(query)
    if d and re.search(r"holiday|chh?utti|छुट्टी|day off", query, re.I):
        return f"holiday calendar {d.year}"
    return ""


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
