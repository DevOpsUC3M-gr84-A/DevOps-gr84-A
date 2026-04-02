"""Workflow de clasificacion de articulos.

RF04 puede reemplazar esta implementacion por el pipeline real de NLP/ML.
"""

import logging

logger = logging.getLogger(__name__)


def classify_article(article_id: str | int) -> None:
    """Stub de clasificacion para desacoplar RF01 de RF04."""
    logger.info(
        "[RF04-STUB] classify_article invocado para article_id=%s", article_id
    )
