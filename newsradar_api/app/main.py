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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "NEWSRADAR_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["system"])
def root():
    return {"message": "Motor API REST de NewsRadar activo. Visita /docs"}


app.include_router(api_router, prefix="/api/v1")
