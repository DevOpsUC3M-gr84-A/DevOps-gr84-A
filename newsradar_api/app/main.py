import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from urllib.parse import urlunsplit

from app.api.router import api_router
from app.core.scheduler import AlertMonitorScheduler
from app.database.database import Base, engine, SessionLocal
import app.models  # noqa: F401
from app.database.init_db import (
    create_initial_admin,
    load_rss_seed_if_empty,
    seed_iptc_categories_and_channels,
    sync_postgres_sequences,
)

logger = logging.getLogger("uvicorn.error")
scheduler = AlertMonitorScheduler()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # El startup NUNCA debe matar el proceso: si init/seed falla, logueamos y
    # dejamos que la API suba igualmente para poder diagnosticar en caliente.
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Startup FastAPI completado: metadata SQLAlchemy cargada")
    except Exception as exc:  # noqa: BLE001 - startup defensivo
        logger.exception("Fallo creando metadata SQLAlchemy: %s", exc)

    db = SessionLocal()
    try:
        try:
            create_initial_admin(db)
        except Exception as exc:  # noqa: BLE001
            logger.exception("create_initial_admin falló: %s", exc)
        try:
            load_rss_seed_if_empty(db)
        except Exception as exc:  # noqa: BLE001
            logger.exception("load_rss_seed_if_empty falló: %s", exc)
        try:
            # CRÍTICO: sincronizar secuencias ANTES del seed IPTC. El seed JSON
            # inserta canales con IDs explícitos y deja la secuencia en 1, así
            # que el siguiente INSERT auto-incremental colisiona con `id=1`
            # (UniqueViolation en rss_channels_pkey).
            sync_postgres_sequences(db)
        except Exception as exc:  # noqa: BLE001
            logger.exception("sync_postgres_sequences (pre-seed IPTC) falló: %s", exc)
        try:
            seed_iptc_categories_and_channels(db)
        except Exception as exc:  # noqa: BLE001
            logger.exception("seed_iptc_categories_and_channels falló: %s", exc)
        try:
            # Re-sync por si el seed IPTC añadió filas con id auto-generado.
            sync_postgres_sequences(db)
        except Exception as exc:  # noqa: BLE001
            logger.exception("sync_postgres_sequences (post-seed) falló: %s", exc)
    finally:
        db.close()

    try:
        scheduler.start()
        logger.info(
            "Scheduler estado: started=%s, cron='%s', next_run_time='%s'",
            scheduler.is_started,
            scheduler.cron_expression,
            scheduler.get_next_run_time(),
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Scheduler no pudo arrancar: %s", exc)

    try:
        yield
    finally:
        try:
            scheduler.shutdown(wait=False)
            logger.info("Shutdown FastAPI completado: scheduler detenido")
        except Exception as exc:  # noqa: BLE001
            logger.exception("Scheduler shutdown falló: %s", exc)

app = FastAPI(
    title="NewsRadar API",
    version="1.0.0",
    description="API REST para gestión de usuarios, alertas, notificaciones, fuentes y canales RSS.",
    lifespan=lifespan,
)

_DEFAULT_DEV_ORIGIN_HOSTS = (
    "localhost:5173",
    "127.0.0.1:5173",
    "localhost:8000",
    "127.0.0.1:8000",
)
_DEFAULT_DEV_ORIGINS = ",".join(
    urlunsplit(("http", host, "", "", "")) for host in _DEFAULT_DEV_ORIGIN_HOSTS
)  # NOSONAR

_allowed_origins_raw = os.getenv("ALLOWED_ORIGINS") or os.getenv(
    "NEWSRADAR_CORS_ORIGINS", _DEFAULT_DEV_ORIGINS
)

allowed_origins = [
    origin.strip() for origin in _allowed_origins_raw.split(",") if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)


@app.get("/", tags=["system"])
def root():
    return {"message": "Motor API REST de NewsRadar activo. Visita /docs"}


@app.get("/health", tags=["system"], status_code=200)
def health():
    return {"status": "ok"}


app.include_router(api_router, prefix="/api/v1")


@app.middleware("http")
async def debug_requests(request: Request, call_next):
    print(f"DEBUG: Petición entrante: {request.method} {request.url}")
    return await call_next(request)
