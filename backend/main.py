"""zanviq-homepage backend — FastAPI.

Public read endpoints serve the site; write endpoints require the admin
session cookie issued at /api/auth/login. Content is stored as markdown +
images on disk (see storage.py).
"""
import mimetypes

from fastapi import Cookie, Depends, FastAPI, File, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse

import auth
import config
import storage
import translate
from models import (
    LoginRequest,
    ProfileInput,
    ProjectInput,
    ReorderRequest,
    TranslateRequest,
    VisibilityRequest,
)

app = FastAPI(title="zanviq-homepage")

config.ensure_dirs()

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"}


# ── Auth ────────────────────────────────────────────────────────────────────

@app.post("/api/auth/login")
def login(payload: LoginRequest, response: Response):
    if not auth.verify_credentials(payload.username, payload.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    auth.set_auth_cookie(response, auth.create_token())
    return {"ok": True}


@app.post("/api/auth/logout")
def logout(response: Response):
    auth.clear_auth_cookie(response)
    return {"ok": True}


@app.get("/api/auth/session")
def session(zanviq_token: str | None = Cookie(default=None)):
    """Lightweight check so the frontend knows whether to show the editor UI."""
    return {"authenticated": auth.is_authenticated(zanviq_token)}


# ── Profile / About ─────────────────────────────────────────────────────────

@app.get("/api/profile")
def read_profile():
    return storage.get_profile()


@app.put("/api/profile", dependencies=[Depends(auth.require_admin)])
def write_profile(payload: ProfileInput):
    return storage.save_profile(payload)


@app.post("/api/profile/images", dependencies=[Depends(auth.require_admin)])
async def upload_profile_image(file: UploadFile = File(...)):
    content = await _read_image(file)
    return {"url": storage.save_profile_image(file.filename or "image", content)}


# ── Projects ────────────────────────────────────────────────────────────────

@app.get("/api/projects")
def list_projects(zanviq_token: str | None = Cookie(default=None)):
    include_unpublished = auth.is_authenticated(zanviq_token)
    return storage.list_projects(include_unpublished=include_unpublished)


@app.get("/api/projects/{slug}")
def read_project(slug: str):
    project = storage.get_project(slug)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.post("/api/projects", dependencies=[Depends(auth.require_admin)])
def create_project(payload: ProjectInput):
    return storage.create_project(payload)


@app.post("/api/projects/reorder", dependencies=[Depends(auth.require_admin)])
def reorder_projects(payload: ReorderRequest):
    storage.reorder_projects(payload.slugs)
    return {"ok": True}


@app.put("/api/projects/{slug}", dependencies=[Depends(auth.require_admin)])
def update_project(slug: str, payload: ProjectInput):
    project = storage.update_project(slug, payload)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.delete("/api/projects/{slug}", dependencies=[Depends(auth.require_admin)])
def delete_project(slug: str):
    if not storage.delete_project(slug):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}


@app.post("/api/projects/{slug}/visibility", dependencies=[Depends(auth.require_admin)])
def set_project_visibility(slug: str, payload: VisibilityRequest):
    meta = storage.set_project_published(slug, payload.published)
    if meta is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True, "published": payload.published}


@app.post("/api/projects/{slug}/images", dependencies=[Depends(auth.require_admin)])
async def upload_project_image(slug: str, file: UploadFile = File(...)):
    if storage.get_project(slug) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    content = await _read_image(file)
    return {"url": storage.save_project_image(slug, file.filename or "image", content)}


# ── Media (public read) ─────────────────────────────────────────────────────

@app.get("/api/media/{rel_path:path}")
def media(rel_path: str):
    path = storage.resolve_media(rel_path)
    if path is None:
        raise HTTPException(status_code=404, detail="Not found")
    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type)


@app.post("/api/translate", dependencies=[Depends(auth.require_admin)])
def do_translate(payload: TranslateRequest):
    try:
        translations = translate.translate_texts(
            payload.texts, payload.source, payload.target
        )
    except translate.TranslationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"translations": translations}


@app.get("/api/translate/available")
def translate_available():
    """Lets the editor decide whether to show the translate button."""
    return {"available": bool(config.GEMINI_API_KEY)}


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── helpers ─────────────────────────────────────────────────────────────────

async def _read_image(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type")
    content = await file.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB)")
    return content
