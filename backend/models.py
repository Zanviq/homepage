"""Pydantic request/response schemas."""
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class Link(BaseModel):
    label: str
    url: str


class ProjectInput(BaseModel):
    """Payload for creating / updating a project."""
    title_ko: str = ""
    title_en: str = ""
    summary_ko: str = ""
    summary_en: str = ""
    body_ko: str = ""
    body_en: str = ""
    tags: list[str] = Field(default_factory=list)
    links: list[Link] = Field(default_factory=list)
    cover: str = ""          # media URL of the cover image
    published: bool = True
    order: int = 0
    slug: str | None = None  # optional; derived from title on create


class ProfileInput(BaseModel):
    """Payload for the About / profile section."""
    name: str = ""
    tagline_ko: str = ""
    tagline_en: str = ""
    about_ko: str = ""
    about_en: str = ""
    avatar: str = ""
    links: list[Link] = Field(default_factory=list)
