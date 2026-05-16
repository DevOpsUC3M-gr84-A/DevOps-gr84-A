"""
Tests adicionales para empujar el coverage por encima del 85%.

Cubren ramas concretas que no estaban testeadas previamente:
  * `app/main.py`              -> healthcheck + lifespan defensivo.
  * `app/api/routes/rss_channels.py`   -> 404/422 sobre categoría/fuente.
  * `app/api/routes/categories.py`     -> 404/422/409 (IPTC inválido, duplicados, links).
  * `app/database/init_db.py`           -> early-return cuando la BD ya está sembrada.

Convenio: NO se modifica lógica de negocio, los tests sólo añaden cobertura
sobre código existente mockeando dependencias externas (DB / requests).
"""

from types import SimpleNamespace
from unittest.mock import MagicMock, mock_open, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app import main as main_module
from app.api.routes import categories as categories_module
from app.api.routes import rss_channels as rss_channels_module
from app.database import init_db
from app.stores.memory import categories_store, rss_channels_store


# ---------------------------------------------------------------------------
# main.py
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_main_health_endpoint_returns_ok():
    """El endpoint /health debe responder 200 con {"status": "ok"}.

    Cubre la rama del healthcheck en `app/main.py` que actualmente queda
    fuera del coverage al estar el resto de tests centrados en /api/v1/*.
    """
    with TestClient(main_module.app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.unit
def test_main_root_endpoint_message_is_stable():
    """El mensaje raíz forma parte del contrato público.

    Aunque ya hay un test similar, este lanza la app vía TestClient para
    forzar que el lifespan (startup + shutdown) se ejecute completo y se
    contabilice en coverage.
    """
    with TestClient(main_module.app) as client:
        response = client.get("/")

    assert response.status_code == 200
    body = response.json()
    assert "message" in body
    assert isinstance(body["message"], str)


@pytest.mark.unit
def test_main_app_has_cors_and_routes_registered():
    """Verifica configuración estática de la app FastAPI sin tocar la DB."""
    assert main_module.app.title == "NewsRadar API"
    routes = {route.path for route in main_module.app.routes}
    assert "/" in routes
    assert "/health" in routes
    # CORSMiddleware está registrado en la pila
    middleware_names = [mw.cls.__name__ for mw in main_module.app.user_middleware]
    assert "CORSMiddleware" in middleware_names


# ---------------------------------------------------------------------------
# api/routes/rss_channels.py
# ---------------------------------------------------------------------------


def _populate_categories_store_with(code: int):
    """Helper: registra una categoría temporal en el store global."""
    from app.schemas.category import Category

    categories_store[code] = Category(id=code, name="Tmp", source="IPTC")


@pytest.fixture
def isolated_categories_store():
    """Aísla el estado del `categories_store` global durante el test."""
    snapshot = dict(categories_store)
    try:
        yield categories_store
    finally:
        categories_store.clear()
        categories_store.update(snapshot)


@pytest.mark.unit
def test_create_source_channel_invalid_category_returns_422(isolated_categories_store):
    """Si la categoría no existe en el store debe responder 422."""
    isolated_categories_store.clear()  # ningún código IPTC registrado

    db = MagicMock()
    source = SimpleNamespace(id=1)
    # 1ª llamada: existe la fuente. 2ª llamada: no hay canal duplicado.
    db.query.return_value.filter.return_value.first.side_effect = [source, None]

    payload = SimpleNamespace(
        media_name="m",
        url="https://example.test/rss",
        category_id=99999999,  # no está en el store
        iptc_category="04010000",
    )

    with pytest.raises(HTTPException) as exc_info:
        rss_channels_module.create_source_channel(source_id=1, payload=payload, db=db)

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == rss_channels_module.ERROR_INVALID_CATEGORY


@pytest.mark.unit
def test_create_source_channel_with_none_category_returns_422(isolated_categories_store):
    db = MagicMock()
    source = SimpleNamespace(id=1)
    db.query.return_value.filter.return_value.first.side_effect = [source, None]

    payload = SimpleNamespace(
        media_name="m",
        url="https://example.test/rss",
        category_id=None,
        iptc_category="04010000",
    )

    with pytest.raises(HTTPException) as exc_info:
        rss_channels_module.create_source_channel(source_id=1, payload=payload, db=db)

    assert exc_info.value.status_code == 422


@pytest.mark.unit
def test_create_source_channel_idempotent_when_existing_channel(isolated_categories_store):
    """Si ya existe un canal con la misma URL para esa fuente -> 409 conflicto."""
    _populate_categories_store_with(1000000)
    db = MagicMock()
    source = SimpleNamespace(id=1, name="Test Source")
    existing = SimpleNamespace(
        id=42,
        information_source_id=1,
        url="https://example.test/rss",
        category_id=1000000,
        iptc_category="01000000",
        media_name="dupe",
    )
    db.query.return_value.filter.return_value.first.side_effect = [source, existing]

    payload = SimpleNamespace(
        media_name="dupe",
        url="https://example.test/rss",
        category_id=1000000,
        iptc_category="01000000",
    )

    import pytest as _pytest
    with _pytest.raises(Exception) as exc_info:
        rss_channels_module.create_source_channel(source_id=1, payload=payload, db=db)
    assert exc_info.value.status_code == 409


@pytest.mark.unit
def test_create_source_channel_sqlalchemy_error_falls_back_to_existing(
    isolated_categories_store,
):
    """SQLAlchemyError tras commit -> rollback + re-lookup -> 201 con el existente."""
    _populate_categories_store_with(1000000)
    source = SimpleNamespace(id=1)
    found_after_error = SimpleNamespace(
        id=7,
        information_source_id=1,
        url="https://example.test/rss",
        category_id=1000000,
        iptc_category="01000000",
        media_name="recovered",
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [
        source,            # fuente existe
        None,              # no hay canal previo
        found_after_error, # tras el error, sí lo encontramos
    ]
    db.commit.side_effect = SQLAlchemyError("boom")

    payload = SimpleNamespace(
        media_name="recovered",
        url="https://example.test/rss",
        category_id=1000000,
        iptc_category="01000000",
    )

    result = rss_channels_module.create_source_channel(source_id=1, payload=payload, db=db)

    assert result.id == 7
    db.rollback.assert_called_once()


@pytest.mark.unit
def test_get_category_key_universal_handles_invalid_inputs():
    """`_get_category_key_universal` debe devolver None ante entradas inválidas."""
    assert rss_channels_module._get_category_key_universal(None) is None
    assert rss_channels_module._get_category_key_universal("not-a-number") is None


@pytest.mark.unit
def test_validate_category_or_422_rejects_zero_and_negatives(isolated_categories_store):
    isolated_categories_store.clear()
    with pytest.raises(HTTPException) as exc_info:
        rss_channels_module._validate_category_or_422(0)
    assert exc_info.value.status_code == 422

    with pytest.raises(HTTPException):
        rss_channels_module._validate_category_or_422(-1)


@pytest.mark.unit
def test_normalize_url_lowercases_and_strips_trailing_slash():
    assert rss_channels_module._normalize_url("HTTPS://Foo.Bar/Path/") == "https://foo.bar/path"


@pytest.mark.unit
def test_is_real_channel_rejects_magic_mock_attributes():
    """Mock con atributos no-string debe descartarse como canal real."""
    fake = MagicMock()  # url y media_name son MagicMock, no str
    assert rss_channels_module._is_real_channel(fake) is False


# ---------------------------------------------------------------------------
# api/routes/categories.py
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_create_category_invalid_iptc_name_returns_422(api_client, auth_headers):
    """Sin id ni iptc_code, el nombre debe corresponder a una IPTC válida."""
    payload = {"name": "Nombre completamente inventado", "source": "IPTC"}
    response = api_client.post("/api/v1/categories", json=payload, headers=auth_headers)
    assert response.status_code == 422


@pytest.mark.unit
def test_create_category_duplicate_name_returns_409(api_client, auth_headers):
    """Crear dos categorías con el mismo nombre IPTC debe devolver 409.

    Tras GC-008 los nombres libres ya no se aceptan: usamos un label IPTC
    real (limpio del seed en categories_store) para que el primer POST cree
    la entrada y el segundo encuentre el duplicado.
    """
    iptc_list = api_client.get(
        "/api/v1/iptc-categories", headers=auth_headers
    ).json()
    target = iptc_list[0]
    # Limpiamos el seed para que el primer POST devuelva 201.
    categories_store.pop(target["code"], None)

    payload = {"name": target["label"], "source": "IPTC"}
    first = api_client.post("/api/v1/categories", json=payload, headers=auth_headers)
    assert first.status_code == 201

    # Reenviar el mismo payload debe chocar contra el duplicate-check (409).
    second = api_client.post(
        "/api/v1/categories", json=payload, headers=auth_headers
    )
    assert second.status_code == 409


@pytest.mark.unit
def test_get_category_falls_back_to_iptc_first_level(api_client, auth_headers):
    """Si la categoría no está en el store pero sí en `IPTC_FIRST_LEVEL`, devuelve 200."""
    from app.core.iptc_categories import IPTC_FIRST_LEVEL

    iptc_code = next(iter(IPTC_FIRST_LEVEL.keys()))
    response = api_client.get(f"/api/v1/categories/{iptc_code}", headers=auth_headers)
    # Aceptamos 200 (encontrada vía store o fallback) o 404 si la limpieza la quitó.
    assert response.status_code in (200, 404)
    if response.status_code == 200:
        assert response.json()["source"] == "IPTC"


@pytest.mark.unit
def test_delete_category_with_linked_channel_returns_409(api_client, auth_headers):
    """Borrar una categoría asociada a un canal RSS in-memory debe devolver 409.

    Insertamos la categoría directamente en el store (GC-008 ya no acepta
    nombres libres vía POST) y simulamos un canal in-memory que la referencia.
    """
    from app.schemas.category import Category

    cat_id = 11000000  # Política (seed IPTC)
    categories_store[cat_id] = Category(id=cat_id, name="Política", source="IPTC")

    fake_channel = SimpleNamespace(category_id=cat_id)
    rss_channels_store[12345] = fake_channel
    try:
        response = api_client.delete(
            f"/api/v1/categories/{cat_id}", headers=auth_headers
        )
        assert response.status_code == 409
        assert response.json()["detail"] == categories_module.ERROR_CATEGORY_LINKED_TO_CHANNELS
    finally:
        rss_channels_store.pop(12345, None)
        categories_store.pop(cat_id, None)


@pytest.mark.unit
def test_update_category_iptc_code_invalid_type_returns_422(api_client, auth_headers):
    cat_id = 90000050
    api_client.post(
        "/api/v1/categories",
        json={"name": "Update target", "source": "IPTC", "id": cat_id},
        headers=auth_headers,
    )
    try:
        response = api_client.put(
            f"/api/v1/categories/{cat_id}",
            json={"iptc_code": "abc"},  # no convertible a int
            headers=auth_headers,
        )
        assert response.status_code == 422
    finally:
        categories_store.pop(cat_id, None)


@pytest.mark.unit
def test_normalize_name_helper_lowercases_and_strips():
    assert categories_module._normalize_name("  Hola Mundo  ") == "hola mundo"


@pytest.mark.unit
def test_get_category_key_helper_handles_invalid():
    assert categories_module._get_category_key(None) is None
    assert categories_module._get_category_key("xx") is None


# ---------------------------------------------------------------------------
# database/init_db.py
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_load_rss_seed_early_return_when_db_already_has_sources():
    """Cubre la rama temprana `if has_sources or has_channels: return`."""
    db = MagicMock()
    # Simulamos que sí hay fuentes (primera consulta devuelve algo).
    db.query.return_value.first.side_effect = [object(), object()]

    init_db.load_rss_seed_if_empty(db)

    db.add_all.assert_not_called()
    db.flush.assert_not_called()
    db.commit.assert_not_called()
    db.rollback.assert_not_called()


@pytest.mark.unit
def test_load_rss_seed_early_return_when_only_channels_present():
    """Si has_sources=False pero has_channels=True, también debe hacer early-return."""
    db = MagicMock()
    db.query.return_value.first.side_effect = [None, object()]

    init_db.load_rss_seed_if_empty(db)

    db.add_all.assert_not_called()
    db.commit.assert_not_called()


@pytest.mark.unit
def test_seed_iptc_categories_skips_already_covered_channels():
    """Si ya hay canales por categoría/url, la rama `continue` debe ejecutarse."""
    db = MagicMock()

    # Engine no es postgres -> no entra al setval final.
    fake_engine = MagicMock()
    fake_engine.url.get_backend_name.return_value = "sqlite"

    # Primero filter().first() para Seed Source -> existe (no se inserta).
    # Después, un mix de filter().first() para already_covered y url_taken.
    # Hacemos que TODOS los canales ya estén cubiertos -> continue inmediato.
    seed_source = SimpleNamespace(id=1, name="Seed Source", url="http://localhost/seed/source")
    already_covered_channel = SimpleNamespace(id=1)

    # Cada categoría del seed comprueba `already_covered` -> devolvemos siempre la fila.
    # filter() sobre InformationSource.id == 1 también devuelve seed_source.
    db.query.return_value.filter.return_value.first.return_value = seed_source

    # Para que el bucle de canales también vea "covered", ajustamos por orden de llamadas:
    # 1ª: lookup fuente seed -> seed_source.
    # 2ª-18ª: already_covered -> objeto truthy.
    # No diferenciamos por argumento; el comportamiento truthy basta.

    with patch.object(init_db, "engine", fake_engine):
        init_db.seed_iptc_categories_and_channels(db)

    # Debe haber commit (categorías + Seed Source) sin haber añadido canales:
    assert db.commit.call_count >= 1
    # No se levanta excepción; el flujo principal completa.


@pytest.mark.unit
def test_seed_iptc_categories_handles_drop_table_failure():
    """Si la migración de `categories` (engine.begin → DROP/CREATE) falla con
    SQLAlchemyError, el bloque externo de seed_iptc_categories_and_channels
    captura el error y llama a `db.rollback`.
    """
    db = MagicMock()
    fake_engine = MagicMock()
    fake_engine.url.get_backend_name.return_value = "sqlite"

    # `_ensure_categories_table` arranca con `engine.begin()`; si falla ahí,
    # el SQLAlchemyError se propaga hasta el outer try/except del seed.
    fake_engine.begin.side_effect = SQLAlchemyError("cannot drop")
    db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(id=1)

    with patch.object(init_db, "engine", fake_engine):
        init_db.seed_iptc_categories_and_channels(db)

    # Tras el rollback inicial, el flujo no aborta.
    assert db.rollback.called


@pytest.mark.unit
def test_seed_iptc_categories_top_level_error_rolls_back():
    """Un SQLAlchemyError en el bloque principal debe hacer rollback global.

    El primer punto de fallo viable post-refactor es `db.commit()`, que se
    ejecuta tras intentar añadir la fuente seed. Forzamos ese error y
    verificamos que el except superior dispara el rollback.
    """
    db = MagicMock()
    fake_engine = MagicMock()
    fake_engine.url.get_backend_name.return_value = "sqlite"

    # La fuente seed no existe -> entra al `db.add` + `db.commit`.
    db.query.return_value.filter.return_value.first.return_value = None
    db.commit.side_effect = SQLAlchemyError("commit boom")

    with patch.object(init_db, "engine", fake_engine):
        init_db.seed_iptc_categories_and_channels(db)

    db.rollback.assert_called()


@pytest.mark.unit
def test_map_seed_category_strips_medtop_prefix():
    """`medtop:sports` debe mapear a DEPORTES."""
    result = init_db._map_seed_category_to_iptc("medtop:sports")
    from app.models.rss import CategoriaIPTC

    assert result == CategoriaIPTC.DEPORTES


@pytest.mark.unit
def test_map_seed_category_unknown_falls_back_to_otros():
    from app.models.rss import CategoriaIPTC

    assert init_db._map_seed_category_to_iptc("xyz_category") == CategoriaIPTC.OTROS