"""Scheduler de monitorizacion de alertas con disparador cron."""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database.database import SessionLocal
from app.services.agents.alert_monitor_agent import run_alert_monitoring_cycle

logger = logging.getLogger("uvicorn.error")


DEFAULT_CRON = "*/1 * * * *"


class AlertMonitorScheduler:
    """Encapsula el scheduler para arrancarlo/pararlo desde FastAPI lifespan."""

    def __init__(self, cron_expression: str | None = None) -> None:
        self._cron_expression = cron_expression or os.getenv(
            "ALERT_MONITOR_CRON", DEFAULT_CRON
        )
        self._scheduler = AsyncIOScheduler(timezone="UTC")
        self._is_started = False

    @property
    def cron_expression(self) -> str:
        return self._cron_expression

    @property
    def is_started(self) -> bool:
        return self._is_started

    def get_next_run_time(self) -> datetime | None:
        job = self._scheduler.get_job("alert_monitoring_job")
        return None if job is None else job.next_run_time

    async def _run_job(self) -> None:
        try:
            await asyncio.to_thread(self._run_job_sync)
        except asyncio.CancelledError:
            logger.info("Scheduler cancelado durante el apagado.")

    def _run_job_sync(self) -> None:
        db = SessionLocal()
        try:
            created_articles = run_alert_monitoring_cycle(db)
            logger.info(
                "Ciclo de monitorizacion completado. Articulos nuevos: %s",
                created_articles,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Error en ciclo de monitorizacion: %s", exc)
        finally:
            db.close()

    def start(self) -> None:
        if self._is_started:
            logger.info("Scheduler ya estaba iniciado")
            return

        trigger = CronTrigger.from_crontab(self._cron_expression, timezone="UTC")
        job = self._scheduler.add_job(
            self._run_job,
            trigger=trigger,
            id="alert_monitoring_job",
            replace_existing=True,
            max_instances=3,
            coalesce=True,
        )

        self._scheduler.start()
        self._is_started = True

        logger.info(
            "Scheduler de monitorizacion iniciado con cron='%s' y next_run_time='%s'",
            self._cron_expression,
            job.next_run_time,
        )

    def stop(self) -> None:
        if not self._is_started:
            return

        self._scheduler.shutdown(wait=False)
        self._is_started = False
        logger.info("Scheduler de monitorizacion detenido")
