import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.scheduler import AlertMonitorScheduler
from app.database.database import Base, engine
import app.models  # noqa: F401

logger = logging.getLogger("uvicorn.error")
scheduler = AlertMonitorScheduler()

app = FastAPI(
    title="NewsRadar API",
    version="1.0.0",
    description="API REST para gestión de usuarios, alertas, notificaciones, fuentes y canales RSS.",
)


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _cors_settings() -> tuple[list[str], str | None, bool]:
    origins = [
        origin.strip()
        for origin in os.getenv("NEWSRADAR_CORS_ORIGINS", "").split(",")
        if origin.strip()
    ]
    origin_regex = os.getenv("NEWSRADAR_CORS_ALLOW_ORIGIN_REGEX", "").strip() or None
    allow_credentials = _env_flag("NEWSRADAR_CORS_ALLOW_CREDENTIALS", default=True)

    # Browsers reject credentials with wildcard origins, so force it off in that case.
    if "*" in origins:
        allow_credentials = False

    return origins, origin_regex, allow_credentials


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    logger.info("Startup FastAPI completado: metadata SQLAlchemy cargada")

    scheduler.start()
    logger.info(
        "Scheduler estado: started=%s, cron='%s', next_run_time='%s'",
        scheduler.is_started,
        scheduler.cron_expression,
        scheduler.get_next_run_time(),
    )


@app.on_event("shutdown")
def on_shutdown() -> None:
    scheduler.stop()
    logger.info("Shutdown FastAPI completado: scheduler detenido")


cors_origins, cors_origin_regex, cors_allow_credentials = _cors_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["system"])
def root():
    return {"message": "Motor API REST de NewsRadar activo. Visita /docs"}


app.include_router(api_router, prefix="/api/v1")
