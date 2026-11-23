"""Settings + profile (UI phase 8, docs/API.md "Settings and profile").

- Profile (everyone): name, job title, a profile picture.
- Company logo (admin), org settings (admin): access defaults for new people and notification
  preferences, stored in organizations.settings (no emails are sent yet).

Images are stored on our own server: <files_dir>/<org slug>/images/ (the atlasv2_files volume,
next to the uploaded documents). Uploads must be PNG, JPEG or WebP (checked by magic bytes and by
decoding), at most 2 MB; they are re-encoded with Pillow to a 256x256 WebP, which also drops
metadata (EXIF location) and anything hidden after the image data. Served only to people of the
same company.
"""

import hashlib
import io
import secrets
from collections.abc import Callable
from datetime import date
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, Response
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from atlas_api.models import Department, Organization, Role, User
from atlas_api.routes import DB, CurrentUser
from atlas_api.settings import settings

router = APIRouter()

MAX_IMAGE_BYTES = 2 * 1024 * 1024
MAX_PIXELS = 40_000_000  # decoded size cap (a 2 MB PNG can claim a huge canvas)
SIZE = 256
MAGIC: dict[str, Callable[[bytes], bool]] = {
    "png": lambda b: b.startswith(b"\x89PNG\r\n\x1a\n"),
    "jpeg": lambda b: b.startswith(b"\xff\xd8\xff"),
    "webp": lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP",
}
PIL_FORMATS = {"png": "PNG", "jpeg": "JPEG", "webp": "WEBP"}

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]


def require_admin(user: CurrentUser) -> User:
    if user.role != Role.admin:
        raise HTTPException(403, "Only admins can change company settings.")
    return user


Admin = Annotated[User, Depends(require_admin)]


# ------------------------------------------------------------------ org settings

DEFAULTS: dict[str, Any] = {
    "access_defaults": {"role": "member", "departments": [], "guest_days": 30},
    "notifications": {"weekly_summary": False, "review_reminders": False},
}


def org_settings(org: Organization) -> dict[str, Any]:
    """The org's settings with defaults filled in (section by section)."""
    raw = org.settings or {}
    return {k: v | (raw.get(k) or {}) for k, v in DEFAULTS.items()}


def access_defaults(org: Organization) -> dict[str, Any]:
    """{role, departments, guest_days} for people added without explicit values."""
    out: dict[str, Any] = org_settings(org)["access_defaults"]
    return out


class AccessDefaults(BaseModel):
    role: Literal["manager", "member", "guest"]
    departments: list[str]
    guest_days: int = Field(ge=1, le=365)


class Notifications(BaseModel):
    weekly_summary: bool
    review_reminders: bool


class OrgSettingsOut(BaseModel):
    access_defaults: AccessDefaults
    notifications: Notifications
    logo_url: str | None


class AccessDefaultsPatch(BaseModel):
    role: Literal["manager", "member", "guest"] | None = None
    departments: list[str] | None = None
    guest_days: int | None = Field(default=None, ge=1, le=365)


class NotificationsPatch(BaseModel):
    weekly_summary: bool | None = None
    review_reminders: bool | None = None


class OrgSettingsPatch(BaseModel):
    access_defaults: AccessDefaultsPatch | None = None
    notifications: NotificationsPatch | None = None


def logo_url(org: Organization) -> str | None:
    v = (org.settings or {}).get("logo")
    return f"/api/org/logo?v={v}" if v else None


def settings_out(org: Organization) -> OrgSettingsOut:
    cur = org_settings(org)
    return OrgSettingsOut(
        access_defaults=AccessDefaults(**cur["access_defaults"]),
        notifications=Notifications(**cur["notifications"]),
        logo_url=logo_url(org),
    )


def set_settings(org: Organization, key: str, value: Any) -> None:
    raw = dict(org.settings or {})
    if value is None:
        raw.pop(key, None)
    else:
        raw[key] = value
    org.settings = raw
    flag_modified(org, "settings")


@router.get("/org/settings")
async def get_org_settings(user: Admin) -> OrgSettingsOut:
    return settings_out(user.org)


@router.patch("/org/settings")
async def change_org_settings(body: OrgSettingsPatch, user: Admin, s: DB) -> OrgSettingsOut:
    org = user.org
    cur = org_settings(org)
    if body.access_defaults is not None:
        patch = body.access_defaults.model_dump(exclude_none=True)
        if "departments" in patch:
            names = sorted(set(patch["departments"]))
            if names:
                found = set(
                    await s.scalars(
                        select(Department.name).where(
                            Department.org_id == org.id, Department.name.in_(names)
                        )
                    )
                )
                missing = [n for n in names if n not in found]
                if missing:
                    raise HTTPException(422, f"No group called {missing[0]} in your company.")
            patch["departments"] = names
        set_settings(org, "access_defaults", cur["access_defaults"] | patch)
    if body.notifications is not None:
        patch = body.notifications.model_dump(exclude_none=True)
        set_settings(org, "notifications", cur["notifications"] | patch)
    await s.commit()
    return settings_out(org)


# ------------------------------------------------------------------ images


def check_image(data: bytes) -> str:
    """The image kind ("png" | "jpeg" | "webp"), or ValueError with a plain reason."""
    if not data:
        raise ValueError("The file is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError("The picture is larger than 2 MB.")
    kind = next((k for k, ok in MAGIC.items() if ok(data)), None)
    if kind is None:
        raise ValueError("Only PNG, JPEG and WebP pictures can be uploaded.")
    return kind


def reencode(data: bytes, kind: str, mode: Literal["cover", "contain"]) -> bytes:
    """Decode, check, and re-encode to a SIZE x SIZE WebP. cover = centre square crop (profile
    pictures), contain = whole image on a transparent square (logos)."""
    try:
        with Image.open(io.BytesIO(data)) as im:
            if im.format != PIL_FORMATS[kind]:
                raise ValueError("This does not look like a real picture file.")
            w, h = im.size
            if w * h > MAX_PIXELS or w < 16 or h < 16:
                raise ValueError("The picture must be between 16 and 6,000 pixels on each side.")
            im.load()
            img = ImageOps.exif_transpose(im).convert("RGBA")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, SyntaxError):
        raise ValueError("This picture could not be read. Try a PNG or JPEG.") from None
    if mode == "cover":
        img = ImageOps.fit(img, (SIZE, SIZE), Image.Resampling.LANCZOS)
    else:
        img = ImageOps.contain(img, (SIZE, SIZE), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        canvas.paste(img, ((SIZE - img.width) // 2, (SIZE - img.height) // 2))
        img = canvas
    out = io.BytesIO()
    img.save(out, "WEBP", quality=85, method=4)
    return out.getvalue()


def images_dir(org: Organization) -> Path:
    return Path(settings.files_dir) / org.slug / "images"


def avatar_path(org: Organization, user_id: int) -> Path:
    return images_dir(org) / f"avatar-{user_id}.webp"


def logo_path(org: Organization) -> Path:
    return images_dir(org) / "logo.webp"


async def read_image(file: UploadFile, mode: Literal["cover", "contain"]) -> bytes:
    data = await file.read(MAX_IMAGE_BYTES + 1)
    try:
        kind = check_image(data)
        return await run_in_threadpool(reencode, data, kind, mode)
    except ValueError as e:
        raise HTTPException(422, str(e)) from None


def store(path: Path, data: bytes) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(f".{secrets.token_hex(4)}.tmp")
    tmp.write_bytes(data)
    tmp.replace(path)
    return hashlib.sha256(data).hexdigest()[:12]


def image_response(path: Path) -> Response:
    if not path.is_file():
        raise HTTPException(404, "No picture.")
    # Same URL + ?v=<version> changes on every upload, so a long private cache is safe.
    return FileResponse(
        path,
        media_type="image/webp",
        headers={
            "Cache-Control": "private, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    )


def avatar_url(u: User) -> str | None:
    return f"/api/people/{u.id}/avatar?v={u.avatar}" if u.avatar else None


# ------------------------------------------------------------------ profile


class ProfileOrg(BaseModel):
    slug: str
    name: str
    logo_url: str | None


class Profile(BaseModel):
    id: int
    email: str
    name: str
    title: str
    role: Role
    departments: list[str]
    guest_until: date | None
    avatar_url: str | None
    org: ProfileOrg


class ProfilePatch(BaseModel):
    name: Name | None = None
    title: Title | None = None


def profile(u: User) -> Profile:
    return Profile(
        id=u.id,
        email=u.email,
        name=u.name,
        title=u.title,
        role=u.role,
        departments=sorted(u.department_names),
        guest_until=u.guest_until,
        avatar_url=avatar_url(u),
        org=ProfileOrg(slug=u.org.slug, name=u.org.name, logo_url=logo_url(u.org)),
    )


@router.get("/profile")
async def get_profile(user: CurrentUser) -> Profile:
    return profile(user)


@router.patch("/profile")
async def change_profile(body: ProfilePatch, user: CurrentUser, s: DB) -> Profile:
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await s.commit()
    return profile(user)


@router.put("/profile/avatar")
async def upload_avatar(user: CurrentUser, s: DB, file: Annotated[UploadFile, File()]) -> Profile:
    data = await read_image(file, "cover")
    user.avatar = store(avatar_path(user.org, user.id), data)
    await s.commit()
    return profile(user)


@router.delete("/profile/avatar", status_code=204)
async def remove_avatar(user: CurrentUser, s: DB) -> Response:
    avatar_path(user.org, user.id).unlink(missing_ok=True)
    user.avatar = None
    await s.commit()
    return Response(status_code=204)


@router.get("/people/{person_id}/avatar")
async def person_avatar(person_id: int, user: CurrentUser, s: DB) -> Response:
    """Anyone in the same company (avatars show in Team, tokens, the sidebar)."""
    other = user if person_id == user.id else await s.get(User, person_id)
    if other is None or other.org_id != user.org_id or not other.avatar:
        raise HTTPException(404, "No picture.")
    return image_response(avatar_path(user.org, person_id))


@router.put("/org/logo")
async def upload_logo(user: Admin, s: DB, file: Annotated[UploadFile, File()]) -> OrgSettingsOut:
    data = await read_image(file, "contain")
    set_settings(user.org, "logo", store(logo_path(user.org), data))
    await s.commit()
    return settings_out(user.org)


@router.delete("/org/logo", status_code=204)
async def remove_logo(user: Admin, s: DB) -> Response:
    logo_path(user.org).unlink(missing_ok=True)
    set_settings(user.org, "logo", None)
    await s.commit()
    return Response(status_code=204)


@router.get("/org/logo")
async def org_logo(user: CurrentUser) -> Response:
    """Private: people of this company only (the website chat does not use it)."""
    if not (user.org.settings or {}).get("logo"):
        raise HTTPException(404, "No logo.")
    return image_response(logo_path(user.org))
