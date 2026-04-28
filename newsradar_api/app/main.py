import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.scheduler import AlertMonitorScheduler
from app.database.database import Base, engine, SessionLocal
import app.models  # noqa: F401
from app.database.init_db import create_initial_admin, load_rss_seed_if_empty

logger = logging.getLogger("uvicorn.error")
scheduler = AlertMonitorScheduler()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(bind=engine)
    logger.info("Startup FastAPI completado: metadata SQLAlchemy cargada")

    db = SessionLocal()
    try:
        create_initial_admin(db)
        load_rss_seed_if_empty(db)
    finally:
        db.close()

    scheduler.start()
    logger.info(
        "Scheduler estado: started=%s, cron='%s', next_run_time='%s'",
        scheduler.is_started,
        scheduler.cron_expression,
        scheduler.get_next_run_time(),
    )

    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
        logger.info("Shutdown FastAPI completado: scheduler detenido")

app = FastAPI(
    title="NewsRadar API",
    version="1.0.0",
    description="API REST para gestión de usuarios, alertas, notificaciones, fuentes y canales RSS.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        *[
            origin.strip()
            for origin in os.getenv("NEWSRADAR_CORS_ORIGINS", "").split(",")
            if origin.strip()
        ],
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)


@app.get("/", tags=["system"])
def root():
    return {"message": "Motor API REST de NewsRadar activo. Visita /docs"}


app.include_router(api_router, prefix="/api/v1")
