import pytest

from atlas_api.uploads import check_upload


@pytest.mark.parametrize(
    ("name", "data", "fmt"),
    [
        ("a.pdf", b"%PDF-1.7 ...", "pdf"),
        ("A.DOCX", b"PK\x03\x04...", "docx"),
        ("notes.md", "# Hi ₹".encode(), "md"),
        ("notes.txt", b"plain", "txt"),
    ],
)
def test_accepts(name: str, data: bytes, fmt: str) -> None:
    assert check_upload(name, data) == fmt


@pytest.mark.parametrize(
    ("name", "data", "reason"),
    [
        ("a.exe", b"MZ", "Only PDF"),
        ("a", b"x", "Only PDF"),
        ("a.pdf", b"PK\x03\x04", "real .pdf"),
        ("a.docx", b"%PDF-", "real .docx"),
        ("a.md", b"\xff\xfe\x00", "UTF-8"),
        ("a.txt", b"a\x00b", "real .txt"),
        ("a.md", b"", "empty"),
        ("a.pdf", b"%PDF-" + b"0" * (10 * 1024 * 1024), "10 MB"),
    ],
)
def test_rejects(name: str, data: bytes, reason: str) -> None:
    with pytest.raises(ValueError, match=reason):
        check_upload(name, data)
