from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
import asyncio

import pytest
from apscheduler.triggers.cron import CronTrigger

from app.core.scheduler import AlertMonitorScheduler


@pytest.mark.unit
def test_scheduler_start_configures_cron_trigger_and_job_id():
    scheduler = AlertMonitorScheduler("*/1 * * * *")

    scheduler_backend = MagicMock()
    scheduler_backend.add_job.return_value = SimpleNamespace(
        next_run_time=datetime.now(timezone.utc)
    )
    scheduler._scheduler = scheduler_backend

    scheduler.start()

    assert scheduler.is_started is True
    scheduler_backend.add_job.assert_called_once()
    kwargs = scheduler_backend.add_job.call_args.kwargs
    assert kwargs["id"] == "alert_monitoring_job"
    assert isinstance(kwargs["trigger"], CronTrigger)
    scheduler_backend.start.assert_called_once()


@pytest.mark.unit
def test_scheduler_run_job_sync_uses_fresh_session_and_closes_it(monkeypatch):
    scheduler = AlertMonitorScheduler("*/1 * * * *")

    fake_db = MagicMock()
    fake_sessionlocal = MagicMock(return_value=fake_db)
    fake_monitor_cycle = MagicMock(return_value=3)

    monkeypatch.setattr("app.core.scheduler.SessionLocal", fake_sessionlocal)
    monkeypatch.setattr(
        "app.core.scheduler.run_alert_monitoring_cycle", fake_monitor_cycle
    )

    scheduler._run_job_sync()

    fake_sessionlocal.assert_called_once()
    fake_monitor_cycle.assert_called_once_with(fake_db)
    fake_db.close.assert_called_once()


@pytest.mark.unit
def test_scheduler_closes_session_even_when_monitor_fails(monkeypatch):
    scheduler = AlertMonitorScheduler("*/1 * * * *")

    fake_db = MagicMock()
    fake_sessionlocal = MagicMock(return_value=fake_db)

    def _raise_error(_):
        raise RuntimeError("monitor failed")

    monkeypatch.setattr("app.core.scheduler.SessionLocal", fake_sessionlocal)
    monkeypatch.setattr("app.core.scheduler.run_alert_monitoring_cycle", _raise_error)

    scheduler._run_job_sync()

    fake_db.close.assert_called_once()


@pytest.mark.unit
def test_scheduler_start_is_idempotent_when_already_started():
    scheduler = AlertMonitorScheduler("*/1 * * * *")
    scheduler_backend = MagicMock()
    scheduler._scheduler = scheduler_backend

    scheduler.start()
    scheduler.start()

    scheduler_backend.add_job.assert_called_once()
    scheduler_backend.start.assert_called_once()


@pytest.mark.unit
def test_scheduler_stop_shuts_down_when_started():
    scheduler = AlertMonitorScheduler("*/1 * * * *")
    scheduler_backend = MagicMock()
    scheduler._scheduler = scheduler_backend

    scheduler.start()
    scheduler.stop()

    scheduler_backend.shutdown.assert_called_once_with(wait=False)
    assert scheduler.is_started is False


@pytest.mark.unit
def test_scheduler_get_next_run_time_and_async_wrapper(monkeypatch):
    scheduler = AlertMonitorScheduler("*/1 * * * *")
    next_run = datetime.now(timezone.utc)
    scheduler_backend = MagicMock()
    scheduler_backend.get_job.return_value = SimpleNamespace(next_run_time=next_run)
    scheduler._scheduler = scheduler_backend

    called = {"sync": False}

    def fake_sync():
        called["sync"] = True

    scheduler._run_job_sync = fake_sync

    assert scheduler.get_next_run_time() == next_run
    asyncio.run(scheduler._run_job())
    assert called["sync"] is True


@pytest.mark.unit
def test_scheduler_run_job_handles_cancelled_error(monkeypatch):
    scheduler = AlertMonitorScheduler("*/1 * * * *")

    async def fake_to_thread(*_args, **_kwargs):
        raise asyncio.CancelledError()

    monkeypatch.setattr("app.core.scheduler.asyncio.to_thread", fake_to_thread)

    # No debe propagar la excepcion durante el apagado.
    asyncio.run(scheduler._run_job())
