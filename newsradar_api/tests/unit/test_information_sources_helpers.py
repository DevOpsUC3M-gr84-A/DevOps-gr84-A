"""Cobertura adicional para `app.api.routes.information_sources`:

- `_normalize_url`: ramas None, trailing slash.
- `_validate_url_reachable`: rama hostname vacío, loopback con/sin puerto,
  dominio no resolvible.
- `_find_source_by_url_ci`: rama de coincidencia URL normalizada.
- `update_information_source`: rama 409 por URL duplicada en otra fuente
  (`_find_source_by_url_ci` con `exclude_id`).
- `create_information_source`: rama 409 cuando la URL ya existe ANTES del
  commit (`_find_source_by_url_ci` no nulo).

El fixture autouse en `tests/conftest.py` reemplaza `_validate_url_reachable`
por un noop; este módulo restaura la referencia real cuando hace falta."""

import socket
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.api.routes import information_sources as mod


_REAL_VALIDATE = mod._validate_url_reachable


@pytest.fixture
def real_validate(monkeypatch):
    monkeypatch.setattr(mod, "_validate_url_reachable", _REAL_VALIDATE)
    return _REAL_VALIDATE


# ---------------------------------------------------------------------------
# _normalize_url
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_normalize_url_none_returns_none():
    assert mod._normalize_url(None) is None


@pytest.mark.unit
def test_normalize_url_strips_trailing_slash_and_lowercases():
    assert mod._normalize_url("HTTPS://Foo.Com/Path/") == "https://foo.com/path"


@pytest.mark.unit
def test_normalize_url_without_trailing_slash_passes_through():
    assert mod._normalize_url("https://foo.com/path") == "https://foo.com/path"


# ---------------------------------------------------------------------------
# _validate_url_reachable
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_validate_url_reachable_empty_hostname_raises_422(real_validate):
    with pytest.raises(HTTPException) as exc_info:
        real_validate("")
    assert exc_info.value.status_code == 422


@pytest.mark.unit
def test_validate_url_reachable_loopback_without_port_is_ok(real_validate):
    """`http://localhost` (sin puerto) cae en el early return loopback."""
    assert real_validate("http://localhost") is None


@pytest.mark.unit
def test_validate_url_reachable_loopback_with_open_port_is_ok(real_validate):
    fake_conn = type("FakeConn", (), {"close": lambda self: None})()
    with patch("socket.create_connection", return_value=fake_conn):
        # `import socket as _sock` dentro de la función importa el mismo
        # módulo, así que el patch global de `socket.create_connection`
        # también lo afecta.
        assert real_validate("http://127.0.0.1:8100") is None


@pytest.mark.unit
def test_validate_url_reachable_loopback_with_closed_port_raises(real_validate):
    with patch("socket.create_connection", side_effect=OSError("refused")):
        with pytest.raises(HTTPException) as exc_info:
            real_validate("http://127.0.0.1:1")
    assert exc_info.value.status_code == 422


@pytest.mark.unit
def test_validate_url_reachable_unresolvable_domain_raises(real_validate):
    with patch.object(mod.socket, "getaddrinfo", side_effect=socket.gaierror):
        with pytest.raises(HTTPException) as exc_info:
            real_validate("https://this-domain-does-not-exist.invalid")
    assert exc_info.value.status_code == 422


@pytest.mark.unit
def test_validate_url_reachable_resolvable_domain_passes(real_validate):
    fake_result = [(None, None, None, None, ("1.2.3.4", 0))]
    with patch.object(mod.socket, "getaddrinfo", return_value=fake_result):
        assert real_validate("https://elpais.com") is None


# ---------------------------------------------------------------------------
# _find_source_by_url_ci
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_find_source_by_url_ci_matches_case_insensitive_with_trailing_slash():
    """El loop normaliza ambas URLs antes de comparar."""
    existing = SimpleNamespace(id=42, name="X", url="HTTPS://Foo.Com/Feed/")
    db = MagicMock()
    db.query.return_value.all.return_value = [existing]

    result = mod._find_source_by_url_ci(db, "https://foo.com/feed")
    assert result is existing


@pytest.mark.unit
def test_find_source_by_url_ci_returns_none_when_no_match():
    db = MagicMock()
    db.query.return_value.all.return_value = [
        SimpleNamespace(id=1, name="A", url="https://a.test"),
        SimpleNamespace(id=2, name="B", url="https://b.test"),
    ]
    assert mod._find_source_by_url_ci(db, "https://c.test") is None


@pytest.mark.unit
def test_find_source_by_url_ci_honors_exclude_id():
    """El filtro `exclude_id` debe aplicarse a la query."""
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []
    assert mod._find_source_by_url_ci(db, "https://foo.com", exclude_id=5) is None
    db.query.return_value.filter.assert_called_once()


# ---------------------------------------------------------------------------
# create_information_source: rama de duplicado previo al commit (line 112)
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_create_information_source_duplicate_url_returns_409():
    existing = SimpleNamespace(id=1, name="Dup", url="https://dup.test")
    db = MagicMock()
    db.query.return_value.all.return_value = [existing]

    payload = SimpleNamespace(name="Otra", url="https://dup.test")

    with pytest.raises(HTTPException) as exc_info:
        mod.create_information_source(payload=payload, db=db)
    assert exc_info.value.status_code == 409
    # No debió intentar guardar
    db.add.assert_not_called()


# ---------------------------------------------------------------------------
# update_information_source: rama de duplicado contra OTRA fila (line 189)
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_update_information_source_duplicate_url_in_other_row_returns_409():
    target = MagicMock(id=1, name="A", url="https://a.test")
    other = SimpleNamespace(id=2, name="Otra", url="https://b.test")

    db = MagicMock()
    # `first()` devuelve la fila que se actualiza; `all()` (filtrado por
    # exclude_id) devuelve la otra fila que ya tiene esa URL.
    db.query.return_value.filter.return_value.first.return_value = target
    db.query.return_value.filter.return_value.all.return_value = [other]

    payload = MagicMock()
    payload.model_dump.return_value = {"url": "https://b.test"}

    with pytest.raises(HTTPException) as exc_info:
        mod.update_information_source(source_id=1, payload=payload, db=db)
    assert exc_info.value.status_code == 409


@pytest.mark.unit
def test_update_information_source_url_none_skips_validation_and_dedup():
    """Si en el payload `url` viene como None explícito, no se llama a
    `_validate_url_reachable` ni a `_find_source_by_url_ci`."""
    target = MagicMock(id=1, name="A", url="https://a.test")
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = target

    payload = MagicMock()
    payload.model_dump.return_value = {"name": "Nuevo", "url": None}

    result = mod.update_information_source(source_id=1, payload=payload, db=db)
    assert result.name == "Nuevo"
    db.commit.assert_called_once()
