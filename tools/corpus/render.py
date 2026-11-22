"""Render one demo-corpus source as a realistic company document (PDF, DOCX or Markdown).

Used by ``scripts/corpus.py``. Each company in ``demo_corpus`` has a brand (colours,
letterhead text, a drawn logo), and every document gets what a real controlled document
has: a letterhead, a running header and footer, a document-control box, styled headings
and tables, a signature block and, where the front matter asks for one, a rubber stamp.

In plain words: the Markdown sources are plain text. This module dresses them up so the
demo looks like a real company's document library, while keeping the PDF's searchable
text clean: everything decorative (logo, stamp, watermark, signatures) is drawn as
shapes or inserted as pictures, so none of it ends up in search results. Only the text a
person could select and copy (letterhead, control box, body, footer) is real text, and the
repeated header/footer lines are exactly what the ingestion cleaner strips.
"""

import hashlib
import html
import io
import math
import random
import re
from dataclasses import dataclass
from datetime import datetime, timedelta

# ── Brands ──


@dataclass(frozen=True)
class Brand:
    name: str  # legal name, printed on the letterhead
    short: str  # running header, stamps
    tagline: str
    address: str
    cin: str
    primary: str  # main brand colour (#rrggbb)
    accent: str  # second colour (logo detail, thin rule)
    dark: str  # headings
    font: str  # CSS font family for PDFs ("sans-serif" or "serif")
    docx_font: str
    logo: str  # which drawn logo (see draw_logo)
    extra: str = ""  # an extra registration line under the CIN


BRANDS = {
    "nimbus": Brand(
        name="Nimbus Infotech Pvt. Ltd.",
        short="Nimbus Infotech",
        tagline="Engineering clarity.",
        address="7th Floor, Tower B, Panchshil Tech Park, Hinjewadi Phase 2, "
        "Pune 411057, Maharashtra",
        cin="U72200PN2009PTC134521",
        primary="#1E88E5",
        accent="#64B5F6",
        dark="#0D2B4E",
        font="sans-serif",
        docx_font="Calibri",
        logo="nimbus",
    ),
    "sanjeevani": Brand(
        name="Sanjeevani Pharma Ltd.",
        short="Sanjeevani Pharma",
        tagline="Healing, made dependable.",
        address="Sanjeevani House, Plot 41, Sarkhej–Gandhinagar Highway, Ahmedabad 380054, Gujarat",
        cin="L24230GJ1994PLC022817",
        primary="#00796B",
        accent="#F9A825",
        dark="#004D40",
        font="sans-serif",
        docx_font="Arial",
        logo="sanjeevani",
    ),
    "kaveri": Brand(
        name="Kaveri Capital Advisors Pvt. Ltd.",
        short="Kaveri Capital",
        tagline="Patient capital, clear thinking.",
        address="12th Floor, Prestige Meridian II, MG Road, Bengaluru 560001, Karnataka",
        cin="U67190KA2012PTC065309",
        primary="#1A237E",
        accent="#C9A227",
        dark="#121858",
        font="serif",
        docx_font="Georgia",
        logo="kaveri",
        extra="SEBI PMS Reg. No. INP000006120",
    ),
}


def brand_for(org: str) -> Brand:
    """The brand for an org folder; an unknown folder gets a plain grey letterhead."""
    if org in BRANDS:
        return BRANDS[org]
    name = org.replace("_", " ").replace("-", " ").title()
    return Brand(
        name=name,
        short=name,
        tagline="",
        address="",
        cin="",
        primary="#455A64",
        accent="#90A4AE",
        dark="#263238",
        font="sans-serif",
        docx_font="Calibri",
        logo="generic",
    )


def _rgb(hex_colour: str) -> tuple[float, float, float]:
    h = hex_colour.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]


def _tint(hex_colour: str, amount: float) -> str:
    """Mix a colour with white (amount 0.9 = 90% white), for light table shading."""
    r, g, b = (round((c + (1 - c) * amount) * 255) for c in _rgb(hex_colour))
    return f"#{r:02X}{g:02X}{b:02X}"


# ── Document metadata ──

# The <TYPE> part of a doc_no ("NIM/HR/POL-004") → the label printed above the title.
DOC_TYPES = {
    "POL": "Policy",
    "SOP": "Standard Operating Procedure",
    "RB": "Runbook",
    "STD": "Standard",
    "PRO": "Proposal",
    "RPT": "Report",
    "MIN": "Minutes of Meeting",
    "GDL": "Guideline",
    "PRT": "Protocol",
    "SPEC": "Specification",
    "CAPA": "Corrective and Preventive Action",
    "NOTE": "Note",
    "FS": "Factsheet",
    "AGR": "Agreement",
}


@dataclass
class DocInfo:
    """Everything the renderers need besides the body."""

    org: str
    title: str
    body: str
    meta: dict[str, str]

    def get(self, key: str, default: str = "") -> str:
        return self.meta.get(key, default).strip()

    @property
    def brand(self) -> Brand:
        return brand_for(self.org)

    @property
    def doc_no(self) -> str:
        return self.get("doc_no")

    @property
    def version(self) -> str:
        return self.get("version", "1.0")

    @property
    def classification(self) -> str:
        return self.get("classification", "Internal")

    @property
    def stamp(self) -> str:
        s = self.get("stamp").upper()
        return "" if s in ("", "NONE") else s

    @property
    def doc_type(self) -> str:
        m = re.search(r"/([A-Z]+)-\d+$", self.doc_no)
        return DOC_TYPES.get(m.group(1), "") if m else ""

    def person(self, key: str) -> tuple[str, str]:
        """Split "Ritika Menon, Manager – HR Operations" into (name, designation)."""
        name, _, role = self.get(key).partition(",")
        return name.strip(), role.strip()

    def dates(self) -> tuple[str, str]:
        """(prepared, approved) dates for the signature block: approval 9 days before the
        effective date, preparation 3 weeks before (minutes: 3 and 10 days after the
        meeting). Falls back to the raw text if the date doesn't parse."""
        eff = self.get("effective")
        try:
            d = datetime.strptime(eff, "%d %B %Y")
        except ValueError:
            return eff, eff
        fmt = "%d %B %Y"
        if self.doc_type == "Minutes of Meeting":  # minutes are written up after the meeting
            return (d + timedelta(days=3)).strftime(fmt), (d + timedelta(days=10)).strftime(fmt)
        return (d - timedelta(days=21)).strftime(fmt), (d - timedelta(days=9)).strftime(fmt)

    def control_rows(self) -> list[tuple[str, str, str, str]]:
        """The document-control box: four rows of two label/value pairs."""
        return [
            ("Document No.", self.doc_no, "Version", self.version),
            ("Effective Date", self.get("effective"), "Review Date", self.get("review")),
            ("Department", self.get("department"), "Classification", self.classification),
            ("Prepared by", self.get("prepared_by"), "Approved by", self.get("approved_by")),
        ]


# ── Markdown → blocks ──
# A small Markdown reader shared by the PDF (via HTML) and DOCX renderers: headings,
# paragraphs, bullet/numbered lists (nested by indentation), pipe tables, code fences,
# block quotes and horizontal rules. Inline: **bold**, *italic*, `code`, [links](url).


@dataclass
class MdBlock:
    kind: str  # heading | para | list | table | code | quote | hr
    text: str = ""
    level: int = 0  # heading level
    items: list | None = None  # list: [(depth, ordered, text)]; table: rows of cells
    aligns: list | None = None  # table: "left" | "right" | "center" per column


_TABLE_SEP = re.compile(r"^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$")
_LIST_ITEM = re.compile(r"^(\s*)([-*+]|\d+[.)])\s+(.*)")
_NUMERIC = re.compile(r"^[-+(]?[₹$€%]?\s?[\d.,]+\s?(%|cr|crore|lakh|L|x|days?|hrs?|h)?\)?$")


def _cells(line: str) -> list[str]:
    line = line.strip().removeprefix("|").removesuffix("|")
    return [c.strip().replace("\\|", "|") for c in re.split(r"(?<!\\)\|", line)]


def parse_markdown(md: str) -> list[MdBlock]:
    lines = md.splitlines()
    blocks: list[MdBlock] = []
    para: list[str] = []

    def flush() -> None:
        if para:
            blocks.append(MdBlock("para", " ".join(para)))
            para.clear()

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped:
            flush()
            i += 1
        elif stripped.startswith("```"):
            flush()
            code = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code.append(lines[i])
                i += 1
            blocks.append(MdBlock("code", "\n".join(code)))
            i += 1
        elif m := re.match(r"^(#{1,6})\s+(.*)", stripped):
            flush()
            blocks.append(MdBlock("heading", m.group(2).strip(), level=len(m.group(1))))
            i += 1
        elif stripped.startswith("|") and i + 1 < len(lines) and _TABLE_SEP.match(lines[i + 1]):
            flush()
            header = _cells(stripped)
            aligns = []
            for sep in _cells(lines[i + 1]):
                right, left = sep.endswith(":"), sep.startswith(":")
                aligns.append("center" if left and right else "right" if right else "left")
            rows = [header]
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(_cells(lines[i]))
                i += 1
            width = len(header)
            rows = [(r + [""] * width)[:width] for r in rows]
            aligns = (aligns + ["left"] * width)[:width]
            # Columns of amounts (₹ 3,500 / 1,180 / 9.5%) read better right-aligned, like
            # a spreadsheet, even if the source didn't say so. Short plain numbers (a
            # version "2.0", a count "18") stay as written.
            for c in range(width):
                values = [r[c].replace("*", "") for r in rows[1:] if r[c]]
                amounts = any(re.search(r"[,₹%$]|\d{4}", v) for v in values)
                if values and amounts and all(_NUMERIC.match(v) for v in values):
                    aligns[c] = "right" if aligns[c] == "left" else aligns[c]
            blocks.append(MdBlock("table", items=rows, aligns=aligns))
        elif re.fullmatch(r"(-{3,}|\*{3,}|_{3,})", stripped):
            flush()
            blocks.append(MdBlock("hr"))
            i += 1
        elif stripped.startswith(">"):
            flush()
            quote = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip()[1:].strip())
                i += 1
            blocks.append(MdBlock("quote", " ".join(q for q in quote if q)))
        elif _LIST_ITEM.match(line):
            flush()
            items: list[tuple[int, bool, str]] = []
            indents: list[int] = []
            while i < len(lines) and lines[i].strip():
                m = _LIST_ITEM.match(lines[i])
                if m:
                    indent = len(m.group(1).expandtabs(4))
                    while indents and indent < indents[-1]:
                        indents.pop()
                    if not indents or indent > indents[-1]:
                        indents.append(indent)
                    ordered = m.group(2)[0].isdigit()
                    items.append((len(indents) - 1, ordered, m.group(3).strip()))
                elif items and (lines[i].startswith(" ") or lines[i].startswith("\t")):
                    d, o, t = items[-1]  # a wrapped continuation line of the last item
                    items[-1] = (d, o, f"{t} {lines[i].strip()}")
                else:
                    break
                i += 1
            blocks.append(MdBlock("list", items=items))
        else:
            para.append(stripped)
            i += 1
    flush()
    return blocks


_INLINE = re.compile(
    r"\*\*(?P<b>.+?)\*\*"
    r"|`(?P<code>[^`]+)`"
    r"|\[(?P<link>[^\]]+)\]\([^)]*\)"
    r"|(?<![\w*])\*(?P<i>[^*\s][^*]*?)\*(?![\w*])"
    r"|(?<!\w)_(?P<i2>[^_\s][^_]*?)_(?!\w)"
)


def inline_runs(text: str) -> list[tuple[str, str]]:
    """Split inline Markdown into (text, style) runs; style is "", "b", "i" or "code"."""
    runs, pos = [], 0
    for m in _INLINE.finditer(text):
        if m.start() > pos:
            runs.append((text[pos : m.start()], ""))
        if m.group("b") is not None:
            runs.append((m.group("b"), "b"))
        elif m.group("code") is not None:
            runs.append((m.group("code"), "code"))
        elif m.group("link") is not None:
            runs.append((m.group("link"), ""))
        else:
            runs.append((m.group("i") or m.group("i2"), "i"))
        pos = m.end()
    if pos < len(text):
        runs.append((text[pos:], ""))
    return runs


def _inline_html(text: str) -> str:
    tags = {"b": "b", "i": "i", "code": "code"}
    out = []
    for t, style in inline_runs(text):
        t = html.escape(t, quote=False)
        out.append(f"<{tags[style]}>{t}</{tags[style]}>" if style else t)
    return "".join(out)


class Fills:
    """Background shading for the PDF body, painted by us instead of by the Story.

    MuPDF's Story layout repeats table-cell backgrounds from earlier pages on later
    pages, so shaded rows and boxes get an id instead, and ``build_pdf`` paints them
    under the text once it knows where each one landed. A band is (first, last, colour):
    table columns first..last-1 of the row (last None = to the end of the row), or
    (None, (x, y), colour) for the element's own box grown by its CSS padding (the Story
    reports the box inside the padding). Colour is a name in ``build_pdf``.
    """

    def __init__(self) -> None:
        self.bands: dict[str, tuple[tuple, ...]] = {}

    def tag(self, *bands: tuple) -> str:
        key = f"bg{len(self.bands)}"
        self.bands[key] = bands
        return f' id="{key}"'


def blocks_to_html(blocks: list[MdBlock], fills: Fills) -> str:
    out = []
    for b in blocks:
        if b.kind == "heading":
            n = min(b.level, 4)
            out.append(f"<h{n}>{_inline_html(b.text)}</h{n}>")
        elif b.kind == "para":
            out.append(f"<p>{_inline_html(b.text)}</p>")
        elif b.kind == "quote":
            shade = fills.tag((None, (8, 5), "tint"))
            out.append(f'<p class="note"{shade}>{_inline_html(b.text)}</p>')
        elif b.kind == "code":
            shade = fills.tag((None, (6, 6), "code"))
            out.append(f"<pre{shade}>{html.escape(b.text, quote=False)}</pre>")
        elif b.kind == "hr":
            out.append("<hr/>")
        elif b.kind == "list":
            out.append(_list_html(b.items or []))
        elif b.kind == "table":
            out.append(_table_html(b.items or [], b.aligns or [], fills))
    return "\n".join(out)


def _list_html(items: list[tuple[int, bool, str]]) -> str:
    out, stack = [], []  # stack of open list tags ("ul"/"ol")
    for depth, ordered, text in items:
        while len(stack) > depth + 1:
            out.append(f"</li></{stack.pop()}>")
        if len(stack) == depth + 1:
            out.append("</li>")
        while len(stack) < depth + 1:
            tag = "ol" if ordered else "ul"
            stack.append(tag)
            out.append(f"<{tag}>")
        out.append(f"<li>{_inline_html(text)}")
    while stack:
        out.append(f"</li></{stack.pop()}>")
    return "".join(out)


def _table_html(rows: list[list[str]], aligns: list[str], fills: Fills) -> str:
    head = "".join(
        f'<th class="{a}">{_inline_html(c)}</th>' for c, a in zip(rows[0], aligns, strict=True)
    )
    body = []
    for n, row in enumerate(rows[1:]):
        cells = "".join(
            f'<td class="{a}">{_inline_html(c)}</td>' for c, a in zip(row, aligns, strict=True)
        )
        body.append(f"<tr{fills.tag((0, None, 'tint')) if n % 2 else ''}>{cells}</tr>")
    shade = fills.tag((0, None, "primary"))
    return f'<table class="data"><tr{shade}>{head}</tr>{"".join(body)}</table>'


def body_blocks(doc: DocInfo) -> list[MdBlock]:
    """The body without its leading "# Title": the renderers print the title themselves."""
    blocks = parse_markdown(doc.body)
    if blocks and blocks[0].kind == "heading" and blocks[0].level == 1:
        blocks = blocks[1:]
    return blocks


# ── Drawn artwork (logos, signatures, stamps) ──
# All vector shapes or pictures, never text, so nothing here reaches the search index.


def draw_logo(page, rect, brand: Brand) -> None:
    """A geometric monogram in brand colours, drawn with shapes inside ``rect``."""
    import pymupdf

    x0, y0, s = rect.x0, rect.y0, min(rect.width, rect.height)

    def p(u: float, v: float):  # unit square → page point
        return pymupdf.Point(x0 + u * s, y0 + v * s)

    primary, accent, dark = _rgb(brand.primary), _rgb(brand.accent), _rgb(brand.dark)
    white = (1, 1, 1)
    sh = page.new_shape()
    if brand.logo == "nimbus":
        # Navy rounded tile, an "N" of two sky-blue posts and a white diagonal, and a
        # small cloud-like dot.
        sh.draw_rect(pymupdf.Rect(p(0, 0), p(1, 1)), radius=0.22)
        sh.finish(fill=dark, color=None)
        sh.draw_line(p(0.27, 0.74), p(0.27, 0.26))
        sh.draw_line(p(0.73, 0.26), p(0.73, 0.74))
        sh.finish(color=primary, width=s * 0.13, lineCap=1)
        sh.draw_line(p(0.27, 0.27), p(0.73, 0.73))
        sh.finish(color=white, width=s * 0.11, lineCap=1)
        sh.draw_circle(p(0.82, 0.18), s * 0.07)
        sh.finish(fill=accent, color=None)
    elif brand.logo == "sanjeevani":
        # Teal disc, white rounded cross, saffron leaf at its centre.
        sh.draw_circle(p(0.5, 0.5), s * 0.5)
        sh.finish(fill=primary, color=None)
        sh.draw_circle(p(0.5, 0.5), s * 0.43)
        sh.finish(color=white, width=s * 0.025, fill=None)
        sh.draw_line(p(0.5, 0.24), p(0.5, 0.76))
        sh.draw_line(p(0.24, 0.5), p(0.76, 0.5))
        sh.finish(color=white, width=s * 0.16, lineCap=1)
        sh.draw_bezier(p(0.36, 0.64), p(0.40, 0.42), p(0.52, 0.36), p(0.64, 0.36))
        sh.draw_bezier(p(0.64, 0.36), p(0.60, 0.58), p(0.48, 0.64), p(0.36, 0.64))
        sh.finish(fill=accent, color=accent, width=s * 0.01, closePath=True)
        sh.draw_line(p(0.37, 0.63), p(0.55, 0.45))
        sh.finish(color=white, width=s * 0.018, lineCap=1)
    elif brand.logo == "kaveri":
        # Navy tile with a gold frame, a gold "K" and a river wave beneath it.
        sh.draw_rect(pymupdf.Rect(p(0, 0), p(1, 1)), radius=0.08)
        sh.finish(fill=primary, color=None)
        sh.draw_rect(pymupdf.Rect(p(0.07, 0.07), p(0.93, 0.93)), radius=0.05)
        sh.finish(color=accent, width=s * 0.025)
        sh.draw_line(p(0.33, 0.2), p(0.33, 0.64))
        sh.draw_line(p(0.68, 0.2), p(0.38, 0.44))
        sh.draw_line(p(0.45, 0.39), p(0.7, 0.64))
        sh.finish(color=accent, width=s * 0.1, lineCap=0)
        sh.draw_bezier(p(0.2, 0.79), p(0.35, 0.69), p(0.45, 0.89), p(0.6, 0.79))
        sh.draw_bezier(p(0.6, 0.79), p(0.7, 0.72), p(0.76, 0.76), p(0.82, 0.79))
        sh.finish(color=white, width=s * 0.045, lineCap=1)
    else:
        sh.draw_rect(pymupdf.Rect(p(0, 0), p(1, 1)), radius=0.2)
        sh.finish(fill=primary, color=None)
        sh.draw_circle(p(0.5, 0.5), s * 0.22)
        sh.finish(color=(1, 1, 1), width=s * 0.08)
    sh.commit()


def _seeded(*parts: str) -> random.Random:
    # Same name → same signature/speckles on every build, so rebuilt files are stable.
    return random.Random(int(hashlib.sha256("|".join(parts).encode()).hexdigest()[:16], 16))


def signature_strokes(name: str) -> list[list[tuple[float, float]]]:
    """A handwriting-like scribble for ``name`` in a 100 × 30 box, as pen strokes.

    Each word starts with a capital (one of a few looped shapes), then cursive humps,
    with the odd tall ascender, dipping descender or small loop, along a slanted, slightly
    rising baseline; the signature ends in a flourish. Deterministic: the random
    generator is seeded from the name, so each person always signs the same way.
    """
    rng = _seeded("sig", name)
    words = [w for w in re.split(r"\s+", name.replace("Dr.", "").strip()) if w][:3] or ["X"]
    slant = rng.uniform(0.15, 0.45)
    capital_style = rng.randrange(3)
    strokes, x = [], 2.0
    for wi, word in enumerate(words):
        base = 21 + rng.uniform(-1.5, 1.5) - wi * rng.uniform(0.5, 2.5)
        tall = rng.uniform(14, 19)
        if capital_style == 0:  # tall loop: up, over, back down through the stem
            pts = [
                (x, base + 1),
                (x + 3, base - tall),
                (x + 7, base - tall + 2),
                (x + 4, base - 3),
                (x + 1, base - 7),
                (x + 8, base - 6),
            ]
        elif capital_style == 1:  # open "C"-like arc
            pts = [
                (x + 9, base - tall + 3),
                (x + 4, base - tall),
                (x, base - tall / 2),
                (x + 2, base),
                (x + 8, base - 3),
            ]
        else:  # stem with a loop at the top
            pts = [
                (x + 1, base + 2),
                (x + 3, base - tall),
                (x + 9, base - tall + 4),
                (x + 2, base - tall / 2),
                (x + 8, base - 5),
            ]
        x += 9
        humps = max(2, min(7, round(len(word) * rng.uniform(0.45, 0.8))))
        for _ in range(humps):
            r = rng.random()
            if r < 0.18:  # ascender (l, h, k)
                pts += [(x + 2, base - rng.uniform(12, 16)), (x + 0.5, base - 9)]
            elif r < 0.3:  # descender (g, y, p)
                pts += [(x + 1.5, base - 5), (x + 2.5, base + rng.uniform(5, 8)), (x, base + 3)]
            elif r < 0.45:  # small loop (e, o)
                up = base - rng.uniform(5, 8)
                pts += [(x + 2.5, up), (x + 0.5, up + 2.5), (x + 3, up + 1)]
            else:
                pts.append((x + rng.uniform(1, 2.5), base - rng.uniform(4, 9)))
            x += rng.uniform(3.5, 6.5)
            pts.append((x, base + rng.uniform(-1, 1.5)))
        strokes.append(pts)
        x += rng.uniform(4, 9)
    last = strokes[-1][-1]
    if rng.random() < 0.6:  # swoop back under the name
        strokes[-1] += [
            (last[0] + 5, last[1] - 4),
            (last[0] + 3, last[1] + 6),
            (rng.uniform(4, 20), 27 + rng.uniform(-1, 2)),
        ]
    else:  # a rising tail and a separate underline stroke
        strokes[-1] += [(last[0] + 6, last[1] - rng.uniform(6, 12))]
        strokes.append([(rng.uniform(0, 10), 27), (x * 0.5, 26), (x * rng.uniform(0.8, 1), 25)])
    # Slant the letters, then scale the signature to its width inside the 100-wide box.
    strokes = [[(px + slant * (22 - py), py) for px, py in s] for s in strokes]
    lo = min(px for s in strokes for px, _ in s)
    span = max(px for s in strokes for px, _ in s) - lo or 1
    k = min(1.5, rng.uniform(72, 98) / span)
    return [[((px - lo) * k, py) for px, py in s] for s in strokes]


def draw_signature(page, rect, name: str) -> None:
    """Draw ``name``'s signature in dark-blue ink, fitted inside ``rect``."""
    import pymupdf

    k = min(rect.width / 100, rect.height / 30)
    ox, oy = rect.x0, rect.y0 + (rect.height - 30 * k) / 2
    sh = page.new_shape()
    for pts in signature_strokes(name):
        P = [pymupdf.Point(ox + x * k, oy + y * k) for x, y in pts]
        # Catmull-Rom → Bézier: a smooth curve through every point.
        for i in range(len(P) - 1):
            p0, p1, p2 = P[max(i - 1, 0)], P[i], P[i + 1]
            p3 = P[min(i + 2, len(P) - 1)]
            sh.draw_bezier(p1, p1 + (p2 - p0) / 6, p2 - (p3 - p1) / 6, p2)
        sh.finish(color=(0.06, 0.15, 0.45), width=max(0.6, 0.9 * k), lineCap=1, lineJoin=1)
    sh.commit()


STAMP_INK = {
    "APPROVED": (0.05, 0.45, 0.2),
    "QA RELEASED": (0.05, 0.45, 0.2),
    "CONTROLLED COPY": (0.1, 0.22, 0.62),
    "BOARD APPROVED": (0.1, 0.22, 0.62),
}
RED_INK = (0.78, 0.1, 0.1)
ROUND_STAMPS = {"BOARD APPROVED", "QA RELEASED"}


def _ink_picture(
    draw, size: tuple[float, float], ink, angle: float, opacity: float, seed: str = "", zoom=4
):
    """Render a drawing to a PNG picture plus a soft mask (transparency), rotated.

    ``draw(page)`` draws in black on a scratch page of ``size``. Random white specks are
    dotted over it so the ink looks unevenly pressed, like a real rubber stamp. Returns
    (png, mask_png, width_pt, height_pt). No ``seed`` = no specks.
    """
    import pymupdf

    scratch = pymupdf.open()
    page = scratch.new_page(width=size[0], height=size[1])
    draw(page)
    if seed:
        rng = _seeded("ink", seed)
        sh = page.new_shape()
        for _ in range(int(size[0] * size[1] / 60)):
            centre = (rng.uniform(0, size[0]), rng.uniform(0, size[1]))
            sh.draw_circle(centre, rng.uniform(0.2, 0.9))
        sh.finish(fill=(1, 1, 1), color=None, fill_opacity=0.75)
        sh.commit()
    gray = page.get_pixmap(
        matrix=pymupdf.Matrix(zoom, zoom).prerotate(angle), colorspace=pymupdf.csGRAY
    )
    # Mask: white paper → fully transparent, black ink → ``opacity``.
    table = bytes(round((255 - v) * opacity) for v in range(256))
    mask = pymupdf.Pixmap(pymupdf.csGRAY, gray.width, gray.height, gray.samples.translate(table), 0)
    rgb = bytes(round(c * 255) for c in ink) * (gray.width * gray.height)
    colour = pymupdf.Pixmap(pymupdf.csRGB, gray.width, gray.height, rgb, 0)
    w, h = gray.width / zoom, gray.height / zoom
    png, mask_png = colour.tobytes("png"), mask.tobytes("png")
    scratch.close()
    return png, mask_png, w, h


def stamp_picture(word: str, brand: Brand, date: str):
    """A rubber stamp (word, company, date): double-bordered box or circle, tilted."""
    import pymupdf

    ink = STAMP_INK.get(word, RED_INK)
    company = brand.short.upper()
    date = date.upper()
    black = (0, 0, 0)

    def centred(page, y: float, text: str, size: float, font: str = "hebo") -> None:
        tw = pymupdf.get_text_length(text, fontname=font, fontsize=size)
        page.insert_text(
            ((page.rect.width - tw) / 2, y), text, fontname=font, fontsize=size, color=black
        )

    def on_arc(page, c, radius: float, text: str, size: float, top: bool) -> None:
        # Letters set around a circle: along the top (reading clockwise) or the bottom
        # (reading anticlockwise), each turned to follow the curve.
        font = "hebo"
        widths = [pymupdf.get_text_length(ch, fontname=font, fontsize=size) * 1.15 for ch in text]
        theta = (
            -math.pi / 2 - sum(widths) / radius / 2
            if top
            else math.pi / 2 + sum(widths) / radius / 2
        )
        for ch, w in zip(text, widths, strict=True):
            point = c + (radius * math.cos(theta), radius * math.sin(theta))
            turn = math.degrees(theta) + 90 if top else math.degrees(theta) - 90
            page.insert_text(
                point,
                ch,
                fontname=font,
                fontsize=size,
                color=black,
                morph=(point, pymupdf.Matrix(-turn)),
            )
            theta += w / radius if top else -w / radius

    if word in ROUND_STAMPS:
        size = (118, 118)

        def draw(page):
            c = pymupdf.Point(59, 59)
            sh = page.new_shape()
            sh.draw_circle(c, 56)
            sh.finish(color=black, width=2.6)
            sh.draw_circle(c, 52.5)
            sh.finish(color=black, width=0.8)
            sh.draw_circle(c, 36)
            sh.finish(color=black, width=0.8)
            for x in (14, 104):  # two dots separating the top and bottom texts
                sh.draw_circle((x, 59), 1.6)
            sh.finish(fill=black, color=None)
            sh.commit()
            on_arc(page, c, 41, company, 8, top=True)
            on_arc(page, c, 47.5, date, 7, top=False)
            first, _, second = word.partition(" ")
            centred(page, 57, first, 10.5)
            centred(page, 70, second, 10.5)
    else:
        width = max(150, pymupdf.get_text_length(word, fontname="hebo", fontsize=17) + 34)
        size = (width, 64)

        def draw(page):
            sh = page.new_shape()
            sh.draw_rect(pymupdf.Rect(2, 2, width - 2, 62), radius=0.12)
            sh.finish(color=black, width=2.6)
            sh.draw_rect(pymupdf.Rect(6.5, 6.5, width - 6.5, 57.5), radius=0.1)
            sh.finish(color=black, width=0.8)
            sh.draw_line((14, 20), (width - 14, 20))
            sh.draw_line((14, 46), (width - 14, 46))
            sh.finish(color=black, width=0.6)
            sh.commit()
            centred(page, 16.5, company, 6.5)
            centred(page, 40, word, 17)
            centred(page, 54.5, date, 6.5, "helv")

    return _ink_picture(draw, size, ink, angle=12, opacity=0.82, seed=f"{word}{brand.name}")


def watermark_picture(word: str = "SUPERSEDED"):
    """A big faint diagonal word for every page of a withdrawn document."""
    import pymupdf

    fs = 84
    w = pymupdf.get_text_length(word, fontname="hebo", fontsize=fs) + 20

    def draw(page):
        page.insert_text((10, fs), word, fontname="hebo", fontsize=fs, color=(0, 0, 0))

    return _ink_picture(draw, (w, fs * 1.3), RED_INK, angle=40, opacity=0.13, zoom=2)


# ── PDF ──

PAGE_MARGIN = 56  # left/right margin in points (~2 cm)


def _pdf_css(b: Brand) -> str:
    line = _tint(b.dark, 0.7)
    return f"""
body {{ font-family: {b.font}; font-size: 10pt; line-height: 1.42; color: #1f2328;
        margin: 0; }}
h1 {{ font-size: 18pt; color: {b.dark}; margin: 0 0 8pt 0; }}
h2 {{ font-size: 12.5pt; color: {b.dark}; margin: 13pt 0 5pt 0; padding-bottom: 2pt;
      border-bottom: 0.7pt solid {b.primary}; }}
h3 {{ font-size: 11pt; color: {b.primary}; margin: 9pt 0 3pt 0; }}
h4 {{ font-size: 10pt; color: {b.dark}; margin: 8pt 0 2pt 0; }}
p {{ margin: 0 0 6pt 0; text-align: justify; }}
ul, ol {{ margin: 0 0 6pt 0; }}
li {{ margin-bottom: 2.5pt; }}
code {{ font-family: monospace; font-size: 9pt; }}
pre {{ font-family: monospace; font-size: 8.3pt; line-height: 1.3;
       border: 0.5pt solid #d5dbe1; padding: 6pt; margin: 0 0 8pt 0; }}
p.note {{ font-size: 9.5pt; border-left: 2.5pt solid {b.accent}; padding: 5pt 8pt;
          text-align: left; }}
hr {{ border-top: 0.5pt solid {line}; margin: 6pt 0; }}
table {{ border-collapse: collapse; width: 100%; }}
td, th {{ font-size: 8.5pt; padding: 3pt 5pt; text-align: left; }}
table.data {{ margin: 3pt 0 10pt 0; }}
table.data th {{ color: #ffffff; border: 0.5pt solid {b.primary}; }}
table.data td {{ border: 0.5pt solid #c3ccd5; }}
table.ctl {{ margin: 2pt 0 14pt 0; }}
table.ctl td {{ border: 0.5pt solid {line}; }}
table.sig {{ margin: 4pt 0 0 0; }}
table.sig td {{ border: 0.5pt solid {line}; padding: 4pt 6pt; }}
td.k {{ color: {b.dark}; font-weight: bold; }}
td.right, th.right {{ text-align: right; }}
td.center, th.center {{ text-align: center; }}
td.h {{ color: #ffffff; font-weight: bold; }}
tr.sign td {{ height: 34pt; }}
"""


def _row(cells: list[str], classes, attrs: str = "") -> str:
    # Labels ("Document No.") get non-breaking spaces so they never wrap: a wrapped label
    # cell splits its table row into two text blocks in the parsed PDF.
    tds = "".join(
        f'<td class="{c}">{html.escape(t.replace(" ", "\u00a0") if c == "k" else t)}</td>'
        for t, c in zip(cells, classes, strict=True)
    )
    return f"<tr{attrs}>{tds}</tr>"


def _pdf_html(doc: DocInfo, fills: Fills) -> str:
    e = html.escape
    parts = []
    parts.append(f"<h1>{e(doc.title)}</h1>")
    labels = ((0, 1, "tint"), (2, 3, "tint"))
    rows = "".join(
        _row(list(r), ("k", "v", "k", "v"), fills.tag(*labels)) for r in doc.control_rows()
    )
    # The id lets build_pdf find where the control box landed, to keep the stamp off it.
    parts.append(f'<table class="ctl" id="ctl">{rows}</table>')
    parts.append(blocks_to_html(body_blocks(doc), fills))

    # Signature block. The empty "sign" row is where the drawn signatures go; its id lets
    # us find where it landed on the page.
    (pn, pd), (an, ad) = doc.person("prepared_by"), doc.person("approved_by")
    prepared_on, approved_on = doc.dates()
    label = (0, 1, "tint")
    fills.bands["sign"] = (label,)
    sig = [
        _row(["", "Prepared by", "Approved by"], ("h", "h", "h"), fills.tag((0, None, "dark"))),
        _row(["Name", pn, an], ("k", "", ""), fills.tag(label)),
        _row(["Designation", pd, ad], ("k", "", ""), fills.tag(label)),
        _row(["Signature", "", ""], ("k", "", ""), ' class="sign" id="sign"'),
        _row(["Date", prepared_on, approved_on], ("k", "", ""), fills.tag(label)),
    ]
    parts.append(f'<h2>Document Approval</h2><table class="sig">{"".join(sig)}</table>')
    return "\n".join(parts)


def _column_edges(verticals, row) -> list[float]:
    """x positions of the cell borders crossing ``row``, left to right."""
    xs = sorted(
        {round((v.x0 + v.x1) / 2, 1) for v in verticals if v.y0 < row.y1 - 1 and v.y1 > row.y0 + 1}
    )
    return xs if len(xs) >= 2 else [row.x0, row.x1]


def build_pdf(doc: DocInfo, out) -> None:
    """Lay the body out with a pymupdf Story, then compose each final page in reading
    order: running header, letterhead (page 1), body, footer. Decorations are added last;
    they are pictures or shapes, so they add nothing to the text layer.

    Order matters: the ingestion parser treats the first and last text block of each page
    as header/footer candidates, so the running header must come first and the footer
    last in each page's content.
    """
    import pymupdf

    b = doc.brand
    page_rect = pymupdf.paper_rect("a4")
    W, H, M = page_rect.width, page_rect.height, PAGE_MARGIN
    first_body = pymupdf.Rect(M, 142 if doc.doc_type else 124, W - M, H - 62)
    other_body = pymupdf.Rect(M, 58, W - M, H - 62)

    fills = Fills()
    story = pymupdf.Story(html=_pdf_html(doc, fills), user_css=_pdf_css(b))
    body_buf = io.BytesIO()
    writer = pymupdf.DocumentWriter(body_buf)
    sign_at: tuple[int, pymupdf.Rect] | None = None
    control_box: pymupdf.Rect | None = None  # where the control table landed on page 1
    shading: dict[int, list[tuple[pymupdf.Rect, tuple]]] = {}  # page → (rect, bands)
    page_no, more = 0, True

    def record(pos) -> None:
        # Called by the Story for every element with an id, on the page just placed.
        nonlocal sign_at, control_box
        if not pos.open_close & 1:  # each element is reported on open and on close
            return
        if pos.id == "sign":
            sign_at = (page_no, pymupdf.Rect(pos.rect))
        if pos.id == "ctl" and page_no == 0:
            control_box = pymupdf.Rect(pos.rect)
        if pos.id in fills.bands:
            shading.setdefault(page_no, []).append((pymupdf.Rect(pos.rect), fills.bands[pos.id]))

    while more:
        device = writer.begin_page(page_rect)
        more, _ = story.place(first_body if page_no == 0 else other_body)
        story.element_positions(record)
        story.draw(device)
        writer.end_page()
        page_no += 1
    writer.close()
    body = pymupdf.open("pdf", body_buf.getvalue())
    # The Story sizes table columns by their content, so read the column edges back from
    # the cell borders it drew (thin vertical rectangles), per page.
    edges = {
        pno: [
            pymupdf.Rect(d["rect"])
            for d in body[pno].get_drawings()
            if d["rect"].width <= 1.5 and d["rect"].height > 3
        ]
        for pno in shading
    }

    pdf = pymupdf.open()
    n = body.page_count
    muted = "#6b7480"
    font_css = f"* {{ font-family: {b.font}; }}"
    header = f"{b.short} · {doc.doc_no}" if doc.doc_no else b.short
    footer_left = f"<b>{html.escape(doc.classification)}</b> · {html.escape(doc.title)} · " + (
        f"Version {html.escape(doc.version)}"
    )
    for i in range(n):
        page = pdf.new_page(width=W, height=H)
        # 1. Running header (first text on every page).
        page.insert_htmlbox(
            pymupdf.Rect(M + 22, 24, W - M, 38),
            f'<p style="font-size:7pt;color:{muted};text-align:right;margin:0">'
            f"{html.escape(header)}</p>",
            css=font_css,
        )
        # 2. Letterhead on page 1.
        if i == 0:
            page.insert_htmlbox(
                pymupdf.Rect(M + 54, 50, M + 290, 100),
                f'<p style="font-size:15pt;font-weight:bold;color:{b.dark};margin:0 0 2pt 0">'
                f"{html.escape(b.name)}</p>"
                f'<p style="font-size:8.5pt;font-style:italic;color:{b.primary};margin:0">'
                f"{html.escape(b.tagline)}</p>",
                css=font_css,
            )
            lines = [f"Regd. Office: {b.address}" if b.address else ""]
            lines += [f"CIN: {b.cin}" if b.cin else "", b.extra]
            page.insert_htmlbox(
                pymupdf.Rect(M + 290, 50, W - M, 104),
                f'<p style="font-size:7pt;line-height:1.35;color:{muted};text-align:right;'
                f'margin:0">{"<br/>".join(html.escape(x) for x in lines if x)}</p>',
                css=font_css,
            )
            # The document type ("STANDARD OPERATING PROCEDURE") above the title. Drawn
            # here, not in the Story, so the parser doesn't glue it onto the title heading.
            if doc.doc_type:
                page.insert_htmlbox(
                    pymupdf.Rect(M, 122, W - M, 134),
                    f'<p style="font-size:7.5pt;font-weight:bold;color:{b.primary};margin:0;'
                    f'letter-spacing:1pt">{html.escape(doc.doc_type.upper())}</p>',
                    css=font_css,
                )
        # 3. The laid-out body, over its shaded rows and boxes.
        colours = {
            "tint": _tint(b.primary, 0.92),
            "primary": b.primary,
            "dark": b.dark,
            "code": "#F3F5F7",
        }
        sh = page.new_shape()
        for r, bands in shading.get(i, []):
            cols = _column_edges(edges.get(i, []), r)
            for first, last, colour in bands:
                if first is None:
                    box = r + (-last[0], -last[1], last[0], last[1])
                else:
                    end = cols[-1] if last is None or last >= len(cols) else cols[last]
                    box = pymupdf.Rect(cols[min(first, len(cols) - 1)], r.y0, end, r.y1)
                sh.draw_rect(box)
                sh.finish(fill=_rgb(colours[colour]), color=None)
        sh.commit()
        page.show_pdf_page(page.rect, body, i)
        # 4. Footer (last text on every page): one table row, so one text block.
        page.insert_htmlbox(
            pymupdf.Rect(M, H - 44, W - M, H - 26),
            f'<table style="width:100%;border-collapse:collapse"><tr>'
            f'<td style="font-size:7pt;color:{muted};padding:0">{footer_left}</td>'
            f'<td style="font-size:7pt;color:{muted};padding:0;text-align:right">'
            f"Page {i + 1} of {n}</td></tr></table>",
            css=font_css,
        )

        # Decorations: shapes and pictures only.
        sh = page.new_shape()
        sh.draw_line((M, H - 48), (W - M, H - 48))
        sh.finish(color=_rgb(_tint(b.dark, 0.6)), width=0.5)
        if i == 0:
            sh.draw_line((M, 110), (W - M, 110))
            sh.finish(color=_rgb(b.primary), width=1.8)
            sh.draw_line((M, 113), (W - M, 113))
            sh.finish(color=_rgb(b.accent), width=0.6)
        else:
            sh.draw_line((M, 42), (W - M, 42))
            sh.finish(color=_rgb(_tint(b.dark, 0.6)), width=0.5)
        sh.commit()
        if i == 0:
            draw_logo(page, pymupdf.Rect(M, 52, M + 44, 96), b)
        else:
            draw_logo(page, pymupdf.Rect(M, 25, M + 13, 38), b)

    # Signatures in the "sign" row: column 2 = prepared by, column 3 = approved by.
    if sign_at:
        pno, row = sign_at
        page = pdf[pno]
        col = (row.width * 0.8) / 2
        for k, key in enumerate(("prepared_by", "approved_by")):
            x0 = row.x0 + row.width * 0.2 + col * k
            draw_signature(
                page,
                pymupdf.Rect(x0 + 8, row.y0 + 3, x0 + col * 0.62, row.y1 - 3),
                doc.person(key)[0],
            )

    if doc.stamp:
        png, mask, w, h = stamp_picture(doc.stamp, b, doc.dates()[1].upper())
        # Top right of page 1, beside the title: between the letterhead rule and the
        # control box, scaled down if needed so it never covers the box (a stamp over
        # "Version 4.2" would hide the text a reader looks for).
        top = 116
        bottom = (control_box.y0 if control_box else first_body.y0 + 40) - 3
        k = min(0.85, (bottom - top) / h)
        w, h = w * k, h * k
        right = W - M + 4
        pdf[0].insert_image(
            pymupdf.Rect(right - w, bottom - h, right, bottom), stream=png, mask=mask
        )
    if doc.stamp == "SUPERSEDED":
        png, mask, w, h = watermark_picture()
        k = min(1.0, (W - 60) / w)
        r = pymupdf.Rect(W / 2 - w * k / 2, H / 2 - h * k / 2, W / 2 + w * k / 2, H / 2 + h * k / 2)
        xref = 0
        for page in pdf:
            xref = page.insert_image(r, stream=png, mask=mask, xref=xref, overlay=False) or xref

    pdf.set_metadata(
        {
            "title": doc.title,
            "author": b.name,
            "subject": doc.doc_no,
            "creator": f"{b.short} Document Control",
            "producer": "",
        }
    )
    pdf.save(str(out), garbage=3, deflate=True)
    pdf.close()
    body.close()


# ── DOCX ──


def _shade(cell, hex_colour: str) -> None:
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_colour.lstrip("#"))
    cell._tc.get_or_add_tcPr().append(shd)


def _bottom_border(paragraph, hex_colour: str, size: int = 12) -> None:
    """A coloured rule under a paragraph (or a paragraph style)."""
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    pbdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    for k, v in (
        ("w:val", "single"),
        ("w:sz", str(size)),
        ("w:space", "4"),
        ("w:color", hex_colour.lstrip("#")),
    ):
        bottom.set(qn(k), v)
    pbdr.append(bottom)
    element = paragraph._p if hasattr(paragraph, "_p") else paragraph.element  # para or style
    ppr = element.get_or_add_pPr()
    # Word wants pBdr before spacing/indent/alignment in a paragraph's properties.
    later = ("w:shd", "w:tabs", "w:spacing", "w:ind", "w:contextualSpacing", "w:jc", "w:rPr")
    ppr.insert_element_before(pbdr, *later)


def _field(paragraph, code: str):
    """A Word field (PAGE, NUMPAGES): Word fills in the number when it shows the page."""
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), code)
    run = OxmlElement("w:r")
    rpr = OxmlElement("w:rPr")  # same look as the footer text around it
    for tag, value in (("w:color", "6B7480"), ("w:sz", "15")):
        el = OxmlElement(tag)
        el.set(qn("w:val"), value)
        rpr.append(el)
    run.append(rpr)
    t = OxmlElement("w:t")
    t.text = "1"
    run.append(t)
    fld.append(run)
    paragraph._p.append(fld)


def _add_runs(paragraph, text: str, size=None, colour=None) -> None:
    from docx.shared import Pt, RGBColor

    for t, style in inline_runs(text):
        run = paragraph.add_run(t)
        run.bold = style == "b" or None
        run.italic = style == "i" or None
        if style == "code":
            run.font.name = "Consolas"
        if size:
            run.font.size = Pt(size)
        if colour:
            run.font.color.rgb = RGBColor.from_string(colour.lstrip("#"))


def _picture_png(draw, size: tuple[float, float]) -> bytes:
    """Draw with pymupdf on a scratch page and return it as a transparent PNG."""
    import pymupdf

    scratch = pymupdf.open()
    page = scratch.new_page(width=size[0], height=size[1])
    draw(page)
    png = page.get_pixmap(matrix=pymupdf.Matrix(5, 5), alpha=True).tobytes("png")
    scratch.close()
    return png


def build_docx(doc: DocInfo, out) -> None:
    import docx
    import pymupdf
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Cm, Pt, RGBColor

    b = doc.brand
    d = docx.Document()
    sec = d.sections[0]
    sec.page_height, sec.page_width = Cm(29.7), Cm(21.0)
    sec.left_margin = sec.right_margin = Cm(2.2)
    sec.top_margin, sec.bottom_margin = Cm(3.0), Cm(2.2)
    text_width = sec.page_width - sec.left_margin - sec.right_margin

    normal = d.styles["Normal"]
    normal.font.name = b.docx_font
    normal.font.size = Pt(10)
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), b.docx_font)
    normal.paragraph_format.space_after = Pt(5)
    normal.paragraph_format.line_spacing = 1.12
    for name, size, colour in (
        ("Title", 20, b.dark),
        ("Heading 1", 15, b.dark),
        ("Heading 2", 13, b.dark),
        ("Heading 3", 11, b.primary),
        ("Heading 4", 10, b.dark),
    ):
        st = d.styles[name]
        st.font.name, st.font.size = b.docx_font, Pt(size)
        st.font.color.rgb = RGBColor.from_string(colour.lstrip("#"))
        rfonts = st.element.rPr.rFonts
        for attr in ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme"):
            rfonts.attrib.pop(qn(attr), None)
        rfonts.set(qn("w:ascii"), b.docx_font)
        rfonts.set(qn("w:hAnsi"), b.docx_font)
    # The default template underlines the Title in its own blue; use the brand colour.
    title_ppr = d.styles["Title"].element.get_or_add_pPr()
    for old in title_ppr.findall(qn("w:pBdr")):
        title_ppr.remove(old)
    _bottom_border(d.styles["Title"], b.primary, 8)

    # Letterhead in the page header: logo + company name, then address and CIN.
    hdr = sec.header
    p = hdr.paragraphs[0]
    p.paragraph_format.tab_stops.add_tab_stop(text_width, WD_TAB_ALIGNMENT.RIGHT)
    logo = _picture_png(lambda pg: draw_logo(pg, pymupdf.Rect(0, 0, 40, 40), b), (40, 40))
    p.add_run().add_picture(io.BytesIO(logo), width=Cm(1.1))
    run = p.add_run(f"  {b.name}")
    run.bold, run.font.size = True, Pt(13)
    run.font.color.rgb = RGBColor.from_string(b.dark.lstrip("#"))
    run = p.add_run(f"\t{doc.doc_no}")
    run.font.size, run.font.color.rgb = Pt(8), RGBColor(0x6B, 0x74, 0x80)
    p2 = hdr.add_paragraph()
    bits = [
        b.tagline,
        f"Regd. Office: {b.address}" if b.address else "",
        f"CIN: {b.cin}" if b.cin else "",
        b.extra,
    ]
    run = p2.add_run("  ·  ".join(x for x in bits if x))
    run.font.size, run.font.color.rgb = Pt(7), RGBColor(0x6B, 0x74, 0x80)
    _bottom_border(p2, b.primary, 12)

    # Footer: classification · title · version · page N of M.
    f = sec.footer.paragraphs[0]
    f.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = f.add_run(doc.classification)
    run.bold = True
    f.add_run(f" · {doc.title} · Version {doc.version} · Page ")
    _field(f, "PAGE")
    f.add_run(" of ")
    _field(f, "NUMPAGES")
    for r in f.runs:
        r.font.size, r.font.color.rgb = Pt(7.5), RGBColor(0x6B, 0x74, 0x80)

    tint = _tint(b.primary, 0.92)

    def table(rows: list[list[str]], header: bool, aligns=None, label_cols=()):
        t = d.add_table(rows=len(rows), cols=len(rows[0]))
        t.style = d.styles["Table Grid"]
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        for r, row in enumerate(rows):
            for c, value in enumerate(row):
                cell = t.cell(r, c)
                para = cell.paragraphs[0]
                para.paragraph_format.space_after = Pt(1)
                if aligns and aligns[c] != "left":
                    para.alignment = (
                        WD_ALIGN_PARAGRAPH.RIGHT
                        if aligns[c] == "right"
                        else WD_ALIGN_PARAGRAPH.CENTER
                    )
                if header and r == 0:
                    _shade(cell, b.primary)
                    _add_runs(para, value.replace("**", ""), 8.5, "#FFFFFF")
                    for run in para.runs:
                        run.bold = True
                elif c in label_cols:
                    _shade(cell, tint)
                    _add_runs(para, value.replace("**", ""), 8.5, b.dark)
                    for run in para.runs:
                        run.bold = True
                else:
                    if header and r % 2 == 0:
                        _shade(cell, tint)
                    _add_runs(para, value, 8.5)
        if header:  # repeat the header row on every page the table spans
            trpr = t.rows[0]._tr.get_or_add_trPr()
            el = OxmlElement("w:tblHeader")
            el.set(qn("w:val"), "true")
            trpr.append(el)
        d.add_paragraph().paragraph_format.space_after = Pt(2)
        return t

    # Title, document type and the document-control table.
    d.add_heading(doc.title, 0)
    if doc.doc_type:
        k = d.add_paragraph()
        run = k.add_run(doc.doc_type.upper())
        run.bold, run.font.size = True, Pt(8)
        run.font.color.rgb = RGBColor.from_string(b.primary.lstrip("#"))
    table([list(r) for r in doc.control_rows()], header=False, label_cols=(0, 2))

    for blk in body_blocks(doc):
        if blk.kind == "heading":
            d.add_heading("", level=min(blk.level, 4))
            _add_runs(d.paragraphs[-1], blk.text)
        elif blk.kind == "para":
            _add_runs(d.add_paragraph(), blk.text)
        elif blk.kind == "quote":
            q = d.add_paragraph(style="Intense Quote")
            _add_runs(q, blk.text)
        elif blk.kind == "code":
            for line in blk.text.splitlines() or [""]:
                c = d.add_paragraph()
                c.paragraph_format.space_after = Pt(0)
                run = c.add_run(line or " ")
                run.font.name, run.font.size = "Consolas", Pt(8.5)
            d.add_paragraph().paragraph_format.space_after = Pt(0)
        elif blk.kind == "list":
            # Numbers are written out ("1. ") rather than using Word's "List Number"
            # style: python-docx gives every numbered list one shared counter, so a
            # second list would carry on from the first one's last number.
            counters = [0, 0, 0]
            for depth, ordered, text in blk.items or []:
                depth = min(depth, 2)
                counters[depth + 1 :] = [0] * (2 - depth)
                level = f" {depth + 1}" if depth else ""
                para = d.add_paragraph(style=("List" if ordered else "List Bullet") + level)
                if ordered:
                    counters[depth] += 1
                    para.paragraph_format.left_indent = Cm(0.63 * (depth + 1))
                    para.paragraph_format.first_line_indent = Cm(-0.63)
                    para.add_run(f"{counters[depth]}.\t")
                _add_runs(para, text)
        elif blk.kind == "table":
            table(blk.items or [[""]], header=True, aligns=blk.aligns)

    # Signature block.
    (pn, pd), (an, ad) = doc.person("prepared_by"), doc.person("approved_by")
    prepared_on, approved_on = doc.dates()
    d.add_heading("Document Approval", level=2)
    t = table(
        [
            ["", "Prepared by", "Approved by"],
            ["Name", pn, an],
            ["Designation", pd, ad],
            ["Signature", "", ""],
            ["Date", prepared_on, approved_on],
        ],
        header=True,
        label_cols=(0,),
    )
    for c, name in ((1, pn), (2, an)):
        sig = _picture_png(lambda pg, nm=name: draw_signature(pg, pg.rect, nm), (100, 30))
        t.cell(3, c).paragraphs[0].add_run().add_picture(io.BytesIO(sig), width=Cm(3.2))

    d.core_properties.title = doc.title
    d.core_properties.author = b.name
    d.core_properties.subject = doc.doc_no
    d.core_properties.category = doc.classification
    d.save(str(out))


# ── Markdown ──


def build_md(doc: DocInfo) -> str:
    """A wiki page: title, a small control table, then the body."""
    rows = [
        ("Document No.", doc.doc_no),
        ("Version", doc.version),
        ("Effective", doc.get("effective")),
        ("Department", doc.get("department")),
        ("Classification", doc.classification),
        ("Approved by", doc.get("approved_by")),
    ]
    rows = [(k, v) for k, v in rows if v]
    head = "| " + " | ".join(k for k, _ in rows) + " |"
    sep = "|" + "|".join("---" for _ in rows) + "|"
    vals = "| " + " | ".join(v for _, v in rows) + " |"
    body = doc.body.strip()
    if m := re.match(r"^#\s+.*\n+", body):
        body = body[m.end() :]
    return f"# {doc.title}\n\n{head}\n{sep}\n{vals}\n\n{body}\n"
