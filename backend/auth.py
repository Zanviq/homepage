"""JWT-cookie authentication for the single admin account."""
import hmac
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Cookie, HTTPException, Response, status

import config


def verify_credentials(username: str, password: str) -> bool:
    """Constant-time comparison against the admin credentials from env."""
    user_ok = hmac.compare_digest(username, config.ADMIN_USERNAME)
    pass_ok = hmac.compare_digest(password, config.ADMIN_PASSWORD)
    return user_ok and pass_ok


def create_token() -> str:
    payload = {
        "sub": config.ADMIN_USERNAME,
        "exp": datetime.now(timezone.utc) + timedelta(hours=config.JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=config.COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,          # served over HTTPS via Cloudflare
        samesite="lax",
        max_age=config.JWT_EXPIRE_HOURS * 3600,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=config.COOKIE_NAME, path="/")


def is_authenticated(token: str | None) -> bool:
    if not token:
        return False
    try:
        jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
        return True
    except jwt.PyJWTError:
        return False


def require_admin(zanviq_token: str | None = Cookie(default=None)) -> None:
    """FastAPI dependency: raises 401 unless a valid session cookie is present."""
    if not is_authenticated(zanviq_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
