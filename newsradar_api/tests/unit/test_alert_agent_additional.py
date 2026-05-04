from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.services.agents import alert_monitor_agent as agent


@pytest.mark.unit
def test_run_alert_monitoring_cycle_returns_zero_when_no_channels_or_alerts(monkeypatch):
    db = MagicMock()

    # Forcamos funciones internas a devolver listas vacías
    monkeypatch.setattr(agent, "_load_active_rss_channels", lambda _db: [])
    monkeypatch.setattr(agent, "_load_active_alerts", lambda _db: [])

    result = agent.run_alert_monitoring_cycle(db)
    assert result == 0


@pytest.mark.unit
def test_dispatch_cycle_emails_calls_dispatch_with_five_payloads(monkeypatch):
    db = MagicMock()

    # Creamos una alerta con usuario
    alert = SimpleNamespace(id=1, user_id=42, notify_email=True, name="TestAlert")
    alerts = [alert]

    # Pending payloads con exactamente 5 entradas
    pending_email_payloads = {1: [{"title": "t", "message": "m"} for _ in range(5)]}

    # Simula que la consulta a User devuelve un usuario con email
    user = SimpleNamespace(email="u@test")
    db.query.return_value.filter.return_value.first.return_value = user

    # Interceptamos la función de dispatch importada en el módulo del agente
    fake_dispatch = MagicMock(return_value=5)
    monkeypatch.setattr(agent, "dispatch_alert_emails_with_cap", fake_dispatch)

    agent._dispatch_cycle_emails(db, alerts, pending_email_payloads)

    # Debe haberse llamado una vez (un id de alerta) y con payloads de longitud 5
    fake_dispatch.assert_called_once()
    called_kwargs = fake_dispatch.call_args.kwargs
    assert called_kwargs["to_email"] == "u@test"
    assert called_kwargs["alert_name"] == "TestAlert"
    assert isinstance(called_kwargs["payloads"], list)
    assert len(called_kwargs["payloads"]) == 5
