import logging
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient

from app.core.config import Settings, get_settings

log = logging.getLogger("auth")


@lru_cache(maxsize=8)
def _jwks_client_for(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url)


def _jwks_client(settings: Settings) -> PyJWKClient:
    return _jwks_client_for(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json")


def _decode(token: str, settings: Settings) -> dict:
    """Verify a Supabase JWT. Tries asymmetric (JWKS) first, then HS256 fallback."""
    header = jwt.get_unverified_header(token)
    alg = header.get("alg", "HS256")

    if alg in {"RS256", "ES256"}:
        signing_key = _jwks_client(settings).get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            signing_key,
            algorithms=[alg],
            options={"verify_aud": False},
        )

    return jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        options={"verify_aud": False},
    )


def get_current_user_id(
    authorization: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    token = authorization.split(" ", 1)[1]
    try:
        payload = _decode(token, settings)
    except jwt.PyJWTError as exc:
        log.warning("JWT verify failed: %s: %s", type(exc).__name__, exc)
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, f"Invalid token: {type(exc).__name__}: {exc}"
        ) from exc

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token missing subject")
    return str(sub)
