import hashlib
from pathlib import Path

from atlas_api.settings import settings

# extension -> magic bytes the file must start with (None = must be UTF-8 text)
FORMATS: dict[str, bytes | None] = {"pdf": b"%PDF-", "docx": b"PK\x03\x04", "md": None, "txt": None}


def check_upload(filename: str, data: bytes) -> str:
    """Return the format, or raise ValueError with a plain-English reason."""
    ext = Path(filename).suffix.lower().lstrip(".")
    if ext not in FORMATS:
        raise ValueError("Only PDF, Word (.docx), Markdown and text files can be uploaded.")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise ValueError(f"The file is larger than {settings.max_upload_mb} MB.")
    if not data:
        raise ValueError("The file is empty.")
    magic = FORMATS[ext]
    if magic is not None:
        if not data.startswith(magic):
            raise ValueError(f"This does not look like a real .{ext} file.")
    else:
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            raise ValueError("Text files must be UTF-8 encoded.") from None
        if "\x00" in text:
            raise ValueError(f"This does not look like a real .{ext} file.")
    return ext


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def save(org_slug: str, digest: str, fmt: str, data: bytes) -> str:
    path = Path(settings.files_dir) / org_slug / f"{digest}.{fmt}"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return str(path)
