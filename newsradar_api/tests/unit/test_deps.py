from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.stores.memory import active_tokens
from app.utils.deps import get_current_gestor, get_current_user


@pytest.mark.unit
def test_get_current_user_without_credentials_raises_401():
    db = MagicMock()

    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials=None, db=db)

    assert exc_info.value.status_code == 401


@pytest.mark.unit
def test_get_current_user_with_invalid_scheme_raises_401():
    db = MagicMock()
    credentials = HTTPAuthorizationCredentials(scheme="Basic", credentials="token")

    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials=credentials, db=db)

    assert exc_info.value.status_code == 401


@pytest.mark.unit
def test_get_current_user_with_invalid_token_raises_401():
    db = MagicMock()
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="expired-token")

    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials=credentials, db=db)

    assert exc_info.value.status_code == 401


@pytest.mark.unit
def test_get_current_user_with_unknown_db_user_raises_401():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")
    active_tokens["valid-token"] = 999

    try:
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(credentials=credentials, db=db)
        assert exc_info.value.status_code == 401
    finally:
        active_tokens.pop("valid-token", None)


@pytest.mark.unit
def test_get_current_gestor_rejects_non_manager():
    current_user = MagicMock(role_ids=[2])

    with pytest.raises(HTTPException) as exc_info:
        get_current_gestor(current_user=current_user)

    assert exc_info.value.status_code == 403


@pytest.mark.unit
def test_get_current_gestor_accepts_manager():
    current_user = MagicMock(role_ids=[1])
    assert get_current_gestor(current_user=current_user) is current_user
