"""Cobertura para el bloque de startup/shutdown defensivo de `app.main`.

El `lifespan` envuelve cada paso (create_all, create_initial_admin, seeds,
sync_postgres_sequences, scheduler.start/shutdown) en su propio try/except
para que un fallo no rompa el proceso. Aquí simulamos fallos en cada paso
para cubrir TODAS las ramas de `except Exception`."""

import importlib
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def reloaded_main():
    """Recarga `app.main` para forzar la re-ejecución del módulo en cada test
    (necesario si se quieren parchear símbolos antes del lifespan)."""
    import app.main as main_module
    importlib.reload(main_module)
    yield main_module


@pytest.mark.unit
def test_root_endpoint_returns_motor_message(reloaded_main):
    """La ruta `/` siempre responde, incluso si el startup logueó errores."""
    with TestClient(reloaded_main.app) as client:
        response = client.get("/")
    assert response.status_code == 200
    assert "NewsRadar" in response.json()["message"]


@pytest.mark.unit
def test_health_endpoint_returns_ok(reloaded_main):
    with TestClient(reloaded_main.app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.unit
def test_lifespan_swallows_metadata_create_all_failure():
    """Si `Base.metadata.create_all` falla, el lifespan registra el error
    pero la app sigue arrancando — ambas llamadas a `create_all` están en
    sendos try/except (líneas 35-36 y 44-45)."""
    import app.main as main_module

    with patch.object(
        main_module.Base.metadata, "create_all", side_effect=RuntimeError("boom")
    ):
        # Con TestClient el lifespan corre al entrar al contexto.
        with TestClient(main_module.app) as client:
            assert client.get("/health").status_code == 200


@pytest.mark.unit
def test_lifespan_swallows_create_initial_admin_failure():
    """Líneas 48-49: `except` del create_initial_admin."""
    import app.main as main_module

    with patch.object(
        main_module, "create_initial_admin", side_effect=RuntimeError("admin-boom")
    ):
        with TestClient(main_module.app) as client:
            assert client.get("/health").status_code == 200


@pytest.mark.unit
def test_lifespan_swallows_load_rss_seed_failure():
    """Líneas 52-53: `except` del load_rss_seed_if_empty."""
    import app.main as main_module

    with patch.object(
        main_module, "load_rss_seed_if_empty", side_effect=RuntimeError("rss-boom")
    ):
        with TestClient(main_module.app) as client:
            assert client.get("/health").status_code == 200


@pytest.mark.unit
def test_lifespan_swallows_sync_postgres_sequences_failure():
    """Líneas 60-61 y 69-70: `except` de las dos llamadas a
    `sync_postgres_sequences` (pre-seed IPTC y post-seed)."""
    import app.main as main_module

    with patch.object(
        main_module,
        "sync_postgres_sequences",
        side_effect=RuntimeError("seq-boom"),
    ):
        with TestClient(main_module.app) as client:
            assert client.get("/health").status_code == 200


@pytest.mark.unit
def test_lifespan_swallows_seed_iptc_failure():
    """Líneas 64-65: `except` de seed_iptc_categories_and_channels."""
    import app.main as main_module

    with patch.object(
        main_module,
        "seed_iptc_categories_and_channels",
        side_effect=RuntimeError("iptc-boom"),
    ):
        with TestClient(main_module.app) as client:
            assert client.get("/health").status_code == 200


@pytest.mark.unit
def test_lifespan_swallows_scheduler_shutdown_failure():
    """Líneas 91-92: `except` del scheduler.shutdown durante el shutdown."""
    import app.main as main_module

    with patch.object(
        main_module.scheduler, "shutdown", side_effect=RuntimeError("sched-shutdown")
    ):
        with TestClient(main_module.app) as client:
            assert client.get("/health").status_code == 200
        # Al salir del contexto se ejecuta el shutdown (rama except cubierta).


@pytest.mark.unit
def test_debug_middleware_does_not_break_pipeline():
    """El middleware imprime un DEBUG y delega; cualquier endpoint sigue OK."""
    import app.main as main_module

    with TestClient(main_module.app) as client:
        assert client.get("/health").status_code == 200
