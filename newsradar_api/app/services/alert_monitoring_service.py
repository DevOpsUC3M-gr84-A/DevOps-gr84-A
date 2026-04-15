"""
Servicio para evaluar alertas y generar notificaciones cuando
una noticia coincide con los criterios de una alerta.
"""

from datetime import datetime
from typing import Dict, Any
from app.stores.memory import alerts_store, notifications_store
from app.schemas.alert import Alert
from app.schemas.notification import Notification


def noticia_coincide_alerta(noticia: Dict[str, Any], alerta: Alert) -> bool:
    """Evalúa si una noticia coincide con los descriptores de una alerta."""
    texto = (noticia.get("title", "") + " " + noticia.get("description", "")).lower()
    return any(descriptor.lower() in texto for descriptor in alerta.descriptors)


def generar_notificacion_si_coincide(noticia: Dict[str, Any]):
    """Genera una notificación si la noticia coincide con alguna alerta activa."""
    for alerta in alerts_store.values():
        if noticia_coincide_alerta(noticia, alerta):
            notificacion = Notification(
                id=len(notifications_store) + 1,
                alert_id=alerta.id,
                timestamp=datetime.now(),
                metrics=[],
            )
            notifications_store[notificacion.id] = notificacion
            print(
                f"Notificación generada para alerta {alerta.id} por noticia '{noticia.get('title','')}'"
            )
