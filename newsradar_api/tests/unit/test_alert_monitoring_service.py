import pytest
from app.schemas.alert import Alert
from app.services import alert_monitoring_service


@pytest.fixture
def sample_alert():
    return Alert(
        id=1,
        user_id=1,
        name="Alerta IA",
        descriptors=["inteligencia artificial", "machine learning"],
        categories=[],
        cron_expression="* * * * *",
    )


@pytest.fixture
def sample_news():
    return {
        "title": "Avances en inteligencia artificial revolucionan la industria",
        "description": "Nuevos modelos de machine learning superan expectativas.",
    }


def test_noticia_coincide_alerta(sample_alert, sample_news):
    assert alert_monitoring_service.noticia_coincide_alerta(sample_news, sample_alert)


def test_generar_notificacion_si_coincide(sample_alert, sample_news, monkeypatch):
    # Prepara el store
    alert_monitoring_service.alerts_store.clear()
    alert_monitoring_service.notifications_store.clear()
    alert_monitoring_service.alerts_store[sample_alert.id] = sample_alert

    alert_monitoring_service.generar_notificacion_si_coincide(sample_news)
    # Debe haberse generado una notificación
    assert len(alert_monitoring_service.notifications_store) == 1
    notif = list(alert_monitoring_service.notifications_store.values())[0]
    assert notif.alert_id == sample_alert.id
