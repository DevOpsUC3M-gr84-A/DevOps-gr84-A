from typing import Annotated, Any, List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.alert_monitoring import AlertRule
from app.models.rss import RSSChannel
from app.models.user import User as DBUser
from app.schemas.alert import Alert, AlertCreate, AlertUpdate
from app.schemas.user import UserInDB
from app.utils.deps import get_current_gestor, get_current_user
from app.utils.keyword_utils import get_related_words


api_alerts_router = APIRouter()


# Endpoint para recomendar palabras relacionadas/sinónimos
@api_alerts_router.get(
    "/alerts/keyword-recommendations",
    tags=["alerts"],
    summary="Recomienda palabras relacionadas o sinónimos para una palabra clave",
    response_model=List[str],
)
def recommend_keywords(keyword: str):
    """
    Devuelve entre 3 y 10 palabras relacionadas o sinónimos para la palabra clave dada.
    """
    return get_related_words(keyword)


ERROR_USER_NOT_FOUND = "Usuario no encontrado"
ERROR_ALERT_NOT_FOUND = "Alerta no encontrada para el usuario"
ERROR_ALERT_CREATE_FAILED = "No se pudo crear la alerta en la base de datos"
ERROR_ALERT_LIMIT_EXCEEDED = "El usuario ha alcanzado el limite maximo de 20 alertas activas"
ERROR_INVALID_RSS_CHANNELS = "Uno o más canales RSS especificados no existen"
MAX_ALERTS_PER_USER = 20


def get_rss_channels_for_categories(db: Session, category_codes: List[str]) -> List[int]:
    """
    RF07: Get all RSS channel IDs that match the given IPTC category codes.

    Args:
        db: Database session
        category_codes: List of IPTC category codes from alert categories

    Returns:
        List of RSS channel IDs matching the categories
    """
    if not category_codes:
        return []

    # Query RSS channels where iptc_category matches any of the alert categories
    channels = (
        db.query(RSSChannel.id)
        .filter(RSSChannel.is_active.is_(True))
        .filter(RSSChannel.iptc_category.in_(category_codes))
        .all()
    )

    return [channel.id for channel in channels]


def _validate_rss_channels(db: Session, rss_channel_ids: List[int]) -> None:
    """Validate that all requested RSS channels exist and are active."""
    existing_channels = (
        db.query(RSSChannel.id)
        .filter(RSSChannel.id.in_(rss_channel_ids), RSSChannel.is_active.is_(True))
        .all()
    )
    existing_ids = [channel.id for channel in existing_channels]
    if len(existing_ids) != len(rss_channel_ids):
        raise HTTPException(status_code=400, detail=ERROR_INVALID_RSS_CHANNELS)


def _extract_category_codes(categories: Any) -> List[str]:
    """Extract IPTC category codes from dict or schema objects."""
    category_codes: List[str] = []
    source = categories if isinstance(categories, list) else []
    for category in source:
        code = category.get("code") if isinstance(category, dict) else getattr(category, "code", None)
        if isinstance(code, str):
            category_codes.append(code)
    return category_codes


@api_alerts_router.get("/users/{user_id}/alerts", tags=["alerts"])
def list_user_alerts(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
) -> List[Alert]:
    db_alerts = (
        db.query(AlertRule)
        .filter(AlertRule.user_id == user_id, AlertRule.is_active.is_(True))
        .all()
    )

    return [
        Alert(
            id=item.id,
            user_id=item.user_id,
            name=item.name,
            descriptors=item.descriptors or [],
            categories=item.categories or [],
            rss_channel_ids=item.rss_channel_ids or [],
            cron_expression=item.cron_expression,
        )
        for item in db_alerts
    ]


@api_alerts_router.post(
    "/users/{user_id}/alerts",
    status_code=201,
    tags=["alerts"],
    responses={
        400: {"description": "Bad Request"},
        404: {"description": "Not found"},
    },
)
def create_user_alert(
    user_id: int,
    payload: AlertCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_gestor)] = None,
) -> Alert:
    owner = db.query(DBUser).filter(DBUser.id == user_id).first()
    if owner is None:
        raise HTTPException(status_code=404, detail=ERROR_USER_NOT_FOUND)

    # RF03: Check alert limit per user
    active_alerts_count = (
        db.query(AlertRule)
        .filter(AlertRule.user_id == user_id, AlertRule.is_active.is_(True))
        .count()
    )
    if active_alerts_count >= MAX_ALERTS_PER_USER:
        raise HTTPException(status_code=400, detail=ERROR_ALERT_LIMIT_EXCEEDED)

    # RF07: Handle RSS channel assignment
    rss_channel_ids = payload.rss_channel_ids
    if rss_channel_ids is None:
        # Auto-assign channels based on alert categories
        category_codes = [cat.code for cat in payload.categories]
        rss_channel_ids = get_rss_channels_for_categories(db, category_codes)
    else:
        # Validate that specified channels exist
        existing_channels = (
            db.query(RSSChannel.id)
            .filter(RSSChannel.id.in_(rss_channel_ids), RSSChannel.is_active.is_(True))
            .all()
        )
        existing_ids = [ch.id for ch in existing_channels]
        if len(existing_ids) != len(rss_channel_ids):
            raise HTTPException(status_code=400, detail=ERROR_INVALID_RSS_CHANNELS)

    db_alert = AlertRule(
        user_id=user_id,
        name=payload.name,
        descriptors=payload.descriptors,
        categories=[category.model_dump() for category in payload.categories],
        rss_channel_ids=rss_channel_ids,
        cron_expression=payload.cron_expression,
        is_active=True,
    )
    db.add(db_alert)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=ERROR_ALERT_CREATE_FAILED,
        ) from exc

    db.refresh(db_alert)
    return Alert(
        id=db_alert.id,
        user_id=user_id,
        name=payload.name,
        descriptors=payload.descriptors,
        categories=payload.categories,
        rss_channel_ids=rss_channel_ids,
        cron_expression=payload.cron_expression,
    )


@api_alerts_router.get(
    "/users/{user_id}/alerts/{alert_id}",
    tags=["alerts"],
    responses={404: {"description": "Not found"}},
)
def get_user_alert(
    user_id: int,
    alert_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
) -> Alert:
    db_alert = (
        db.query(AlertRule)
        .filter(
            AlertRule.id == alert_id,
            AlertRule.user_id == user_id,
            AlertRule.is_active.is_(True),
        )
        .first()
    )
    if db_alert is None:
        raise HTTPException(status_code=404, detail=ERROR_ALERT_NOT_FOUND)

    return Alert(
        id=db_alert.id,
        user_id=db_alert.user_id,
        name=db_alert.name,
        descriptors=db_alert.descriptors or [],
        categories=db_alert.categories or [],
        rss_channel_ids=db_alert.rss_channel_ids or [],
        cron_expression=db_alert.cron_expression,
    )


@api_alerts_router.put(
    "/users/{user_id}/alerts/{alert_id}",
    tags=["alerts"],
    responses={
        400: {"description": "Invalid RSS channels data"},
        404: {"description": "Not found"},
    },
)
def update_user_alert(
    user_id: int,
    alert_id: int,
    payload: AlertUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_gestor)] = None,
) -> Alert:
    db_alert = (
        db.query(AlertRule)
        .filter(
            AlertRule.id == alert_id,
            AlertRule.user_id == user_id,
            AlertRule.is_active.is_(True),
        )
        .first()
    )

    if db_alert is None:
        raise HTTPException(status_code=404, detail=ERROR_ALERT_NOT_FOUND)

    update_data = payload.model_dump(exclude_unset=True)
    if "name" in update_data:
        db_alert.name = update_data["name"]
    if "descriptors" in update_data:
        db_alert.descriptors = update_data["descriptors"]
    if "categories" in update_data:
        db_alert.categories = [
            item.model_dump() if hasattr(item, "model_dump") else item
            for item in update_data["categories"]
        ]
    if "rss_channel_ids" in update_data:
        rss_channel_ids = update_data["rss_channel_ids"]
        if rss_channel_ids is None:
            category_codes = _extract_category_codes(db_alert.categories or [])
            rss_channel_ids = get_rss_channels_for_categories(db, category_codes)
        else:
            _validate_rss_channels(db, rss_channel_ids)
        db_alert.rss_channel_ids = rss_channel_ids
    if "cron_expression" in update_data:
        db_alert.cron_expression = update_data["cron_expression"]

    db.commit()
    db.refresh(db_alert)

    return Alert(
        id=db_alert.id,
        user_id=db_alert.user_id,
        name=db_alert.name,
        descriptors=db_alert.descriptors or [],
        categories=db_alert.categories or [],
        rss_channel_ids=db_alert.rss_channel_ids or [],
        cron_expression=db_alert.cron_expression,
    )


@api_alerts_router.delete(
    "/users/{user_id}/alerts/{alert_id}",
    status_code=204,
    response_class=Response,
    tags=["alerts"],
    responses={404: {"description": "Not found"}},
)
def delete_user_alert(
    user_id: int,
    alert_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_gestor)] = None,
) -> None:
    db_alert = (
        db.query(AlertRule)
        .filter(AlertRule.id == alert_id, AlertRule.user_id == user_id)
        .first()
    )
    if db_alert is None:
        raise HTTPException(status_code=404, detail=ERROR_ALERT_NOT_FOUND)

    db_alert.is_active = False
    db.commit()
