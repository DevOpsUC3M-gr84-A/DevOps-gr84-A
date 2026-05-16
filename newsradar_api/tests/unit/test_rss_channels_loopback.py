"""Cobertura específica para la lógica nueva de rewrite/validación de URLs
loopback en `app.api.routes.rss_channels`:

- `_rewrite_loopback_for_docker`: rama Docker vs no-Docker, hosts loopback vs
  públicos, soporte de port + userinfo.
- `_validate_url_reachable`: short-circuit fuera de loopback, fallo de socket
  -> HTTPException 400, default de puerto según esquema.
- `_reject_known_bad_urls`: blacklist semántico (example.*, github API) y
  delegación al validator tras reescritura.
- `_validate_category_or_422` y `_category_id_to_iptc`: ramas con valores no
  convertibles a int y códigos IPTC desconocidos.

Estos tests son hermeticos: no abren sockets reales (monkeypatchean
`socket.create_connection`) y no requieren ejecutarse dentro de un
contenedor (monkeypatchean `_running_in_docker`)."""

from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.api.routes import rss_channels as mod
from app.models.rss import CategoriaIPTC


# `tests/conftest.py` instala un autouse que sobreescribe
# `_validate_url_reachable` con un noop para que los tests de endpoints no
# necesiten red. En este módulo queremos ejercitar el código *real*, así que
# capturamos la referencia original a nivel de import y la reinyectamos en
# cada test que la necesite.
_REAL_VALIDATE_URL_REACHABLE = mod._validate_url_reachable


@pytest.fixture
def real_validator(monkeypatch):
    """Restaura `_validate_url_reachable` real durante el test."""
    monkeypatch.setattr(mod, "_validate_url_reachable", _REAL_VALIDATE_URL_REACHABLE)
    return _REAL_VALIDATE_URL_REACHABLE


# ---------------------------------------------------------------------------
# _rewrite_loopback_for_docker
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_rewrite_loopback_returns_url_unchanged_outside_docker():
    with patch.object(mod, "_running_in_docker", return_value=False):
        assert (
            mod._rewrite_loopback_for_docker("http://127.0.0.1:8100/rss")
            == "http://127.0.0.1:8100/rss"
        )


@pytest.mark.unit
def test_rewrite_loopback_empty_url_returns_empty():
    """Rama temprana: url vacía no se procesa aunque estemos en Docker."""
    with patch.object(mod, "_running_in_docker", return_value=True):
        assert mod._rewrite_loopback_for_docker("") == ""


@pytest.mark.unit
def test_rewrite_loopback_rewrites_127_with_port_in_docker():
    with patch.object(mod, "_running_in_docker", return_value=True):
        result = mod._rewrite_loopback_for_docker("http://127.0.0.1:8100/rss")
    assert result == "http://host.docker.internal:8100/rss"


@pytest.mark.unit
def test_rewrite_loopback_rewrites_localhost_without_port():
    with patch.object(mod, "_running_in_docker", return_value=True):
        result = mod._rewrite_loopback_for_docker("https://localhost/feed.xml")
    assert result == "https://host.docker.internal/feed.xml"


@pytest.mark.unit
def test_rewrite_loopback_preserves_userinfo():
    with patch.object(mod, "_running_in_docker", return_value=True):
        result = mod._rewrite_loopback_for_docker("http://user:pass@127.0.0.1:80/x")
    assert result == "http://user:pass@host.docker.internal:80/x"


@pytest.mark.unit
def test_rewrite_loopback_userinfo_without_password():
    with patch.object(mod, "_running_in_docker", return_value=True):
        result = mod._rewrite_loopback_for_docker("http://user@127.0.0.1/x")
    assert result == "http://user@host.docker.internal/x"


@pytest.mark.unit
def test_rewrite_loopback_leaves_public_host_alone():
    """Solo loopback se reescribe: dominios públicos pasan sin cambios."""
    with patch.object(mod, "_running_in_docker", return_value=True):
        result = mod._rewrite_loopback_for_docker("https://elpais.com/rss")
    assert result == "https://elpais.com/rss"


@pytest.mark.unit
def test_rewrite_loopback_handles_unparseable_url():
    """Una URL irrecuperable cae al except y devuelve el valor original."""
    with patch.object(mod, "_running_in_docker", return_value=True):
        # `urlparse` rara vez falla, pero forzamos la rama del try/except.
        with patch.object(mod, "urlparse", side_effect=ValueError("bad")):
            assert mod._rewrite_loopback_for_docker("http://127.0.0.1") == "http://127.0.0.1"


# ---------------------------------------------------------------------------
# _validate_url_reachable
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_validate_url_reachable_noop_for_public_host(real_validator):
    """Hosts no-loopback no abren sockets; debe ser un noop silencioso."""
    assert real_validator("https://elpais.com/rss") is None


@pytest.mark.unit
def test_validate_url_reachable_noop_for_empty_url(real_validator):
    assert real_validator("") is None


@pytest.mark.unit
def test_validate_url_reachable_succeeds_when_socket_opens(real_validator):
    """Si el socket abre, no se levanta excepción y la conexión se cierra."""
    fake_conn = type("FakeConn", (), {"close": lambda self: None})()
    with patch.object(mod.socket, "create_connection", return_value=fake_conn) as create:
        assert real_validator("http://127.0.0.1:8100/rss") is None
        create.assert_called_once_with(("127.0.0.1", 8100), timeout=1)


@pytest.mark.unit
def test_validate_url_reachable_defaults_port_80_for_http_without_port(real_validator):
    fake_conn = type("FakeConn", (), {"close": lambda self: None})()
    with patch.object(mod.socket, "create_connection", return_value=fake_conn) as create:
        real_validator("http://127.0.0.1/feed")
        create.assert_called_once_with(("127.0.0.1", 80), timeout=1)


@pytest.mark.unit
def test_validate_url_reachable_defaults_port_443_for_https_without_port(real_validator):
    fake_conn = type("FakeConn", (), {"close": lambda self: None})()
    with patch.object(mod.socket, "create_connection", return_value=fake_conn) as create:
        real_validator("https://localhost/feed")
        create.assert_called_once_with(("localhost", 443), timeout=1)


@pytest.mark.unit
def test_validate_url_reachable_raises_400_when_socket_closed(real_validator):
    """Si `create_connection` lanza OSError, mapeamos a 400 'url no accesible'."""
    with patch.object(
        mod.socket, "create_connection", side_effect=OSError("refused")
    ):
        with pytest.raises(HTTPException) as exc_info:
            real_validator("http://127.0.0.1:1/rss")
    assert exc_info.value.status_code == 400
    assert "no accesible" in exc_info.value.detail


# ---------------------------------------------------------------------------
# _reject_known_bad_urls
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.parametrize(
    "url",
    [
        "https://example.com/feed",
        "https://www.example.org/rss",
        "http://EXAMPLE.com/x",  # case-insensitive
    ],
)
def test_reject_known_bad_urls_blocks_example_domains(url):
    with pytest.raises(HTTPException) as exc_info:
        mod._reject_known_bad_urls(url)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "url no es rss"


@pytest.mark.unit
def test_reject_known_bad_urls_blocks_github_api():
    with pytest.raises(HTTPException) as exc_info:
        mod._reject_known_bad_urls("https://api.github.com/users")
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "url no xml"


@pytest.mark.unit
def test_reject_known_bad_urls_empty_url_returns_empty():
    assert mod._reject_known_bad_urls("") == ""


@pytest.mark.unit
def test_reject_known_bad_urls_public_host_passes_through():
    """Sin loopback, la validación de socket no se invoca y se devuelve la URL."""
    assert (
        mod._reject_known_bad_urls("https://elpais.com/rss")
        == "https://elpais.com/rss"
    )


@pytest.mark.unit
@pytest.mark.parametrize(
    "url, expected",
    [
        (
            "http://127.0.0.1:8100/rss",
            "http://host.docker.internal:8100/rss",
        ),
        (
            "http://localhost:8100/rss",
            "http://host.docker.internal:8100/rss",
        ),
        (
            "http://localhost:8100/feed.xml",
            "http://host.docker.internal:8100/feed.xml",
        ),
    ],
)
def test_reject_known_bad_urls_port_8100_always_rewrites_without_socket(url, expected):
    """Bypass del Mock M5: el puerto 8100 siempre se reescribe a
    `host.docker.internal:8100` y NO se invoca ninguna validación de socket,
    independientemente de si corremos dentro de Docker."""
    with patch.object(mod, "_validate_url_reachable") as validator, patch.object(
        mod.socket, "create_connection"
    ) as sock:
        result = mod._reject_known_bad_urls(url)
    assert result == expected
    validator.assert_not_called()
    sock.assert_not_called()


@pytest.mark.unit
@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1:1/down",
        "http://127.0.0.1/feed",
        "http://localhost:9999/x",
        "http://0.0.0.0:80/y",
        "http://LOCALHOST:1234/z",  # case-insensitive
    ],
)
def test_reject_known_bad_urls_non_8100_loopback_raises_400_without_socket(url):
    """Kill-switch ciego: cualquier loopback que no sea el puerto 8100 lanza
    400 inmediatamente, sin tocar la red ni `_validate_url_reachable`."""
    with patch.object(mod, "_validate_url_reachable") as validator, patch.object(
        mod.socket, "create_connection"
    ) as sock:
        with pytest.raises(HTTPException) as exc_info:
            mod._reject_known_bad_urls(url)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "url no accesible"
    validator.assert_not_called()
    sock.assert_not_called()


# ---------------------------------------------------------------------------
# _validate_category_or_422 / _category_id_to_iptc
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_validate_category_raises_422_when_none():
    with pytest.raises(HTTPException) as exc_info:
        mod._validate_category_or_422(None)
    assert exc_info.value.status_code == 422


@pytest.mark.unit
@pytest.mark.parametrize("value", ["abc", "1.2", object()])
def test_validate_category_raises_422_for_non_int(value):
    with pytest.raises(HTTPException) as exc_info:
        mod._validate_category_or_422(value)
    assert exc_info.value.status_code == 422


@pytest.mark.unit
def test_validate_category_rejects_zero_and_negative():
    for value in (0, -3):
        with pytest.raises(HTTPException) as exc_info:
            mod._validate_category_or_422(value)
        assert exc_info.value.status_code == 422


@pytest.mark.unit
def test_validate_category_accepts_string_padded_id():
    """El helper acepta el formato padded "01000000" además del entero puro
    porque las claves del store pueden venir en cualquiera de las dos formas
    según el flujo (SMOKE-005 vs POST/PUT)."""
    assert mod._validate_category_or_422("01000000") == 1000000


@pytest.mark.unit
def test_validate_category_raises_422_for_unknown_code():
    with pytest.raises(HTTPException) as exc_info:
        mod._validate_category_or_422(99999999)
    assert exc_info.value.status_code == 422


@pytest.mark.unit
def test_category_id_to_iptc_returns_otros_for_unconvertible():
    assert mod._category_id_to_iptc("xx") is CategoriaIPTC.OTROS


@pytest.mark.unit
def test_category_id_to_iptc_returns_otros_for_invalid_code():
    assert mod._category_id_to_iptc(99999999) is CategoriaIPTC.OTROS


@pytest.mark.unit
def test_category_id_to_iptc_returns_matching_enum_for_valid_int():
    # 4010000 -> "04010000" -> TECNOLOGIA
    assert mod._category_id_to_iptc(4010000) is CategoriaIPTC.TECNOLOGIA


# ---------------------------------------------------------------------------
# _get_category_key_universal y _normalize_url
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_get_category_key_universal_handles_none():
    assert mod._get_category_key_universal(None) is None


@pytest.mark.unit
def test_get_category_key_universal_handles_unconvertible():
    assert mod._get_category_key_universal("not-a-number") is None


@pytest.mark.unit
def test_get_category_key_universal_falls_back_to_iptc_first_level():
    """11000000 es una clave IPTC pero puede no estar en el store; el helper
    debe devolverla igualmente mediante el fallback IPTC_FIRST_LEVEL."""
    from app.stores.memory import categories_store

    categories_store.pop(11000000, None)
    categories_store.pop("11000000", None)
    categories_store.pop("11000000".zfill(8), None)
    assert mod._get_category_key_universal(11000000) == 11000000


@pytest.mark.unit
def test_normalize_url_lowercases_and_trims_trailing_slash():
    assert mod._normalize_url("HTTPS://Foo.Com/Feed/") == "https://foo.com/feed"


@pytest.mark.unit
def test_is_real_channel_rejects_magicmock_payloads():
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    assert mod._is_real_channel(MagicMock()) is False
    real = SimpleNamespace(url="https://x.test/rss", media_name="m")
    assert mod._is_real_channel(real) is True
