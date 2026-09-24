"""Authentication for the single admin account.

Browsers use a JWT session cookie; the content CLI uses a static bearer token
(ADMIN_API_TOKEN). Either one grants full admin rights.
"""
import hmac
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Cookie, Header, HTTPException, Response, status

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


def is_valid_api_token(authorization: str | None) -> bool:
    """True if the `Authorization: Bearer <token>` header matches ADMIN_API_TOKEN."""
    if not config.ADMIN_API_TOKEN or not authorization:
        return False
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return False
    return hmac.compare_digest(token.strip(), config.ADMIN_API_TOKEN)


def is_admin(zanviq_token: str | None, authorization: str | None) -> bool:
    return is_authenticated(zanviq_token) or is_valid_api_token(authorization)


def require_admin(
    zanviq_token: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
) -> None:
    """FastAPI dependency: raises 401 unless a valid session cookie or API token is present."""
    if not is_admin(zanviq_token, authorization):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
