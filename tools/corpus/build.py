"""Render the demo corpus: demo_corpus/source/<org>/*.md -> demo_corpus/build/<org>/*.pdf|docx|md.

    uv run --with pymupdf --with python-docx python tools/corpus/build.py [--org nimbus] [--only-missing] [--check]

Front matter is `key: value` lines (see demo_corpus/SPEC.md). `--check` validates every
source (required keys, access is a department in demo_corpus/orgs/<org>.json or Everyone) without rendering.
"""

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "demo_corpus"
SOURCE, BUILD = CORPUS / "source", CORPUS / "build"
REQUIRED = ("title", "access", "format", "doc_no")


def read(path: Path) -> tuple[dict[str, str], str]:
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", path.read_text(), re.S)
    if not m:
        raise ValueError(f"{path}: missing front matter")
    meta = {}
    for line in m.group(1).splitlines():
        if line.strip():
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
    return meta, m.group(2).strip() + "\n"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--org")
    ap.add_argument("--only-missing", action="store_true")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    departments = {}
    for f in sorted((CORPUS / "orgs").glob("*.json")):
        org = json.loads(f.read_text())
        departments[org["slug"]] = {d["name"] for d in org["departments"]} | {"Everyone"}

    sys.path.insert(0, str(Path(__file__).parent))
    import render as r  # noqa: E402

    errors, count, doc_nos = [], 0, set()
    for org_dir in sorted(p for p in SOURCE.iterdir() if p.is_dir()):
        if args.org and org_dir.name != args.org:
            continue
        for path in sorted(org_dir.glob("*.md")):
            meta, body = read(path)
            missing = [k for k in REQUIRED if not meta.get(k)]
            if missing:
                errors.append(f"{path.name}: missing {', '.join(missing)}")
                continue
            if meta["format"] not in ("pdf", "docx", "md"):
                errors.append(f"{path.name}: bad format {meta['format']}")
            known = departments.get(org_dir.name)
            if known is not None and meta["access"] not in known:
                errors.append(f"{path.name}: access '{meta['access']}' is not a department of {org_dir.name}")
            key = (org_dir.name, meta["doc_no"])
            if key in doc_nos:
                errors.append(f"{path.name}: duplicate doc_no {meta['doc_no']}")
            doc_nos.add(key)
            count += 1
            if args.check:
                continue
            out = BUILD / org_dir.name / f"{path.stem}.{meta['format']}"
            out.parent.mkdir(parents=True, exist_ok=True)
            if args.only_missing and out.exists():
                continue
            info = r.DocInfo(org_dir.name, meta["title"], body, meta)
            if meta["format"] == "pdf":
                r.build_pdf(info, out)
            elif meta["format"] == "docx":
                r.build_docx(info, out)
            else:
                out.write_text(r.build_md(info))
    print(f"{count} documents" + (" checked" if args.check else " processed"))
    if errors:
        print("\n".join(errors))
        sys.exit(1)


if __name__ == "__main__":
    main()
