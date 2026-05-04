"""Workflow de clasificacion de articulos.

RF04 puede reemplazar esta implementacion por el pipeline real de NLP/ML.
RF08: Clasificación de Noticias según categoría IPTC de alerta o canal RSS origen.
"""

import logging
import os
from elasticsearch import Elasticsearch
from sqlalchemy.orm import Session
from app.database.database import SessionLocal
from app.models.alert_monitoring import AlertRule
from app.models.rss import RSSChannel

logger = logging.getLogger(__name__)
ELASTICSEARCH_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")


def _get_first_level_iptc_category(iptc_code: str | None) -> str | None:
    """Extrae la categoría IPTC de primer nivel (6 primeros caracteres del código).
    
    Ejemplo: "04010000" -> "04010000" (ya es nivel 1, los 6 primeros dígitos)
    Ejemplo: "04010001" -> "04010000" (nivel 2/3, se convierte a nivel 1)
    
    En IPTC: Los primeros 8 dígitos forman el código, donde:
    - Primeros 2 dígitos: categoría principal
    - Dígitos 3-4: subcategoría
    - Dígitos 5-8: niveles más específicos
    
    Nivel 1 = primeros 4 dígitos + "0000"
    """
    if not iptc_code or len(iptc_code) < 4:
        return None
    
    # Tomar primeros 4 dígitos + "0000" = nivel 1 IPTC
    return iptc_code[:4] + "0000"


def classify_article(article_id: str | int) -> None:
    """
    RF08: Clasifica una noticia según la categoría IPTC de la alerta 
    o, en su defecto, según la del canal RSS origen.
    
    Precedencia:
    1. Categoría IPTC de la alerta (primer nivel)
    2. Categoría IPTC del canal RSS (primer nivel)
    """
    es_client = Elasticsearch(ELASTICSEARCH_URL)
    
    try:
        # Recuperar el documento indexado en Elasticsearch
        response = es_client.get(index="articles", id=str(article_id))
        article = response["_source"]
    except Exception as exc:
        logger.error("No se pudo recuperar article_id=%s de Elasticsearch: %s", article_id, exc)
        return
    
    db: Session = SessionLocal()
    try:
        alert_id = article.get("alert_id")
        channel_id = article.get("channel_id")
        
        if not alert_id or not channel_id:
            logger.warning("Artículo incompleto: alert_id=%s, channel_id=%s", alert_id, channel_id)
            return
        
        # Obtener la alerta para conocer sus categorías IPTC
        alert = db.query(AlertRule).filter(AlertRule.id == alert_id).first()
        if not alert:
            logger.warning("Alerta no encontrada para alert_id=%s", alert_id)
            return
        
        # Obtener el canal RSS para su categoría IPTC de fallback
        channel = db.query(RSSChannel).filter(RSSChannel.id == channel_id).first()
        if not channel:
            logger.warning("Canal RSS no encontrado para channel_id=%s", channel_id)
            return
        
        # RF08: Determinar categorías IPTC según precedencia
        classified_categories: list[str] = []
        source_of_category = None

        # Precedencia 1: Todas las categorías de la alerta (primer nivel)
        if alert.categories:
            alert_categories = alert.categories if isinstance(alert.categories, list) else []
            seen: set[str] = set()
            for cat in alert_categories:
                code = cat.get("code") if isinstance(cat, dict) else str(cat)
                level1_code = _get_first_level_iptc_category(code)
                if level1_code and level1_code not in seen:
                    classified_categories.append(level1_code)
                    seen.add(level1_code)
            if classified_categories:
                source_of_category = "alert"

        # Fallback: Categoría del canal RSS (primer nivel)
        if not classified_categories and channel.iptc_category:
            channel_code = (
                channel.iptc_category.value
                if hasattr(channel.iptc_category, "value")
                else str(channel.iptc_category)
            )
            level1_code = _get_first_level_iptc_category(channel_code)
            if level1_code:
                classified_categories = [level1_code]
                source_of_category = "channel"

        # Si no hay categoría, registrar advertencia
        if not classified_categories:
            logger.warning(
                "No se pudo determinar categoría IPTC para article_id=%s "
                "(alert_categories=%s, channel_category=%s)",
                article_id,
                alert.categories,
                channel.iptc_category,
            )
            return

        # Actualizar el documento en Elasticsearch.
        # iptc_category almacena una lista: Elasticsearch acumula cada valor
        # en su propio bucket dentro de la agregación terms del dashboard.
        article["iptc_category"] = classified_categories
        article["iptc_category_source"] = source_of_category

        es_client.index(
            index="articles",
            id=str(article_id),
            document=article,
        )

        logger.info(
            "RF08: Artículo clasificado article_id=%s categories=%s source=%s",
            article_id,
            classified_categories,
            source_of_category,
        )
    
    except Exception as exc:
        logger.exception("Error en classify_article para article_id=%s: %s", article_id, exc)
    
    finally:
        db.close()
