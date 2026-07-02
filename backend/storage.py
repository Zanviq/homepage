"""File-based persistence. Every project is a folder of markdown + a meta.json.

Layout (rooted at DATA_DIR, bind-mounted from /mnt/hdd/homepage):

    projects/<slug>/meta.json      metadata (titles, tags, links, ...)
    projects/<slug>/body.ko.md     Korean body
    projects/<slug>/body.en.md     English body
    projects/<slug>/images/*       uploaded images
    about/profile.json             profile metadata
    about/about.ko.md              Korean about text
    about/about.en.md              English about text
"""
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import config
from models import ProfileInput, ProjectInput


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "project"


def _unique_slug(base: str) -> str:
    slug = base
    i = 2
    while (config.PROJECTS_DIR / slug).exists():
        slug = f"{base}-{i}"
        i += 1
    return slug


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


# ── Projects ────────────────────────────────────────────────────────────────

def _project_dir(slug: str) -> Path:
    return config.PROJECTS_DIR / slug


def _load_meta(slug: str) -> dict | None:
    meta_path = _project_dir(slug) / "meta.json"
    if not meta_path.exists():
        return None
    return json.loads(meta_path.read_text(encoding="utf-8"))


def list_projects(include_unpublished: bool) -> list[dict]:
    if not config.PROJECTS_DIR.exists():
        return []
    items: list[dict] = []
    for child in config.PROJECTS_DIR.iterdir():
        if not child.is_dir():
            continue
        meta = _load_meta(child.name)
        if meta is None:
            continue
        if not include_unpublished and not meta.get("published", True):
            continue
        items.append(meta)
    items.sort(key=lambda m: (m.get("order", 0), m.get("created_at", "")))
    return items


def get_project(slug: str) -> dict | None:
    meta = _load_meta(slug)
    if meta is None:
        return None
    project_dir = _project_dir(slug)
    return {
        **meta,
        "body_ko": _read_text(project_dir / "body.ko.md"),
        "body_en": _read_text(project_dir / "body.en.md"),
    }


def create_project(data: ProjectInput) -> dict:
    base = _slugify(data.slug or data.title_en or data.title_ko or "project")
    slug = _unique_slug(base)
    project_dir = _project_dir(slug)
    (project_dir / "images").mkdir(parents=True, exist_ok=True)

    now = _now()
    meta = {
        "slug": slug,
        "title_ko": data.title_ko,
        "title_en": data.title_en,
        "summary_ko": data.summary_ko,
        "summary_en": data.summary_en,
        "tags": data.tags,
        "links": [link.model_dump() for link in data.links],
        "cover": data.cover,
        "published": data.published,
        "order": data.order,
        "created_at": now,
        "updated_at": now,
    }
    _write_project(slug, meta, data.body_ko, data.body_en)
    return get_project(slug)


def update_project(slug: str, data: ProjectInput) -> dict | None:
    meta = _load_meta(slug)
    if meta is None:
        return None
    meta.update({
        "title_ko": data.title_ko,
        "title_en": data.title_en,
        "summary_ko": data.summary_ko,
        "summary_en": data.summary_en,
        "tags": data.tags,
        "links": [link.model_dump() for link in data.links],
        "cover": data.cover,
        "published": data.published,
        "order": data.order,
        "updated_at": _now(),
    })
    _write_project(slug, meta, data.body_ko, data.body_en)
    return get_project(slug)


def _write_project(slug: str, meta: dict, body_ko: str, body_en: str) -> None:
    project_dir = _project_dir(slug)
    project_dir.mkdir(parents=True, exist_ok=True)
    (project_dir / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (project_dir / "body.ko.md").write_text(body_ko, encoding="utf-8")
    (project_dir / "body.en.md").write_text(body_en, encoding="utf-8")


def delete_project(slug: str) -> bool:
    project_dir = _project_dir(slug)
    if not project_dir.exists():
        return False
    import shutil
    shutil.rmtree(project_dir)
    return True


def save_project_image(slug: str, filename: str, content: bytes) -> str:
    images_dir = _project_dir(slug) / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    safe = _safe_filename(filename)
    target = _unique_path(images_dir / safe)
    target.write_bytes(content)
    return f"/api/media/projects/{slug}/images/{target.name}"


# ── Profile / About ─────────────────────────────────────────────────────────

def get_profile() -> dict:
    profile_path = config.ABOUT_DIR / "profile.json"
    meta = (
        json.loads(profile_path.read_text(encoding="utf-8"))
        if profile_path.exists()
        else {}
    )
    return {
        "name": meta.get("name", ""),
        "tagline_ko": meta.get("tagline_ko", ""),
        "tagline_en": meta.get("tagline_en", ""),
        "avatar": meta.get("avatar", ""),
        "links": meta.get("links", []),
        "history": meta.get("history", []),
        "about_ko": _read_text(config.ABOUT_DIR / "about.ko.md"),
        "about_en": _read_text(config.ABOUT_DIR / "about.en.md"),
    }


def save_profile(data: ProfileInput) -> dict:
    config.ABOUT_DIR.mkdir(parents=True, exist_ok=True)
    meta = {
        "name": data.name,
        "tagline_ko": data.tagline_ko,
        "tagline_en": data.tagline_en,
        "avatar": data.avatar,
        "links": [link.model_dump() for link in data.links],
        "history": [item.model_dump() for item in data.history],
    }
    (config.ABOUT_DIR / "profile.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (config.ABOUT_DIR / "about.ko.md").write_text(data.about_ko, encoding="utf-8")
    (config.ABOUT_DIR / "about.en.md").write_text(data.about_en, encoding="utf-8")
    return get_profile()


def save_profile_image(filename: str, content: bytes) -> str:
    images_dir = config.ABOUT_DIR / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    safe = _safe_filename(filename)
    target = _unique_path(images_dir / safe)
    target.write_bytes(content)
    return f"/api/media/about/images/{target.name}"


# ── Media path resolution ───────────────────────────────────────────────────

def resolve_media(rel_path: str) -> Path | None:
    """Resolve a media URL path to a real file, guarding against traversal."""
    candidate = (config.DATA_DIR / rel_path).resolve()
    root = config.DATA_DIR.resolve()
    if root not in candidate.parents and candidate != root:
        return None
    if not candidate.is_file():
        return None
    return candidate


# ── helpers ─────────────────────────────────────────────────────────────────

def _safe_filename(filename: str) -> str:
    name = Path(filename).name
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    return name or "file"


def _unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    stem, suffix = path.stem, path.suffix
    i = 2
    while True:
        candidate = path.with_name(f"{stem}-{i}{suffix}")
        if not candidate.exists():
            return candidate
        i += 1
