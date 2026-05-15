from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.alert_monitoring import AlertRule
from app.models.rss import CategoriaIPTC, RSSChannel
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
)
def recommend_keywords(keyword: str) -> dict:
    """
    Devuelve entre 3 y 10 descriptores relacionados con la palabra clave dada
    bajo la clave `descriptors` (RN-001).
    """
    return {"descriptors": get_related_words(keyword)}


ERROR_USER_NOT_FOUND = "Usuario no encontrado"
ERROR_ALERT_NOT_FOUND = "Alerta no encontrada para el usuario"
ERROR_ALERT_CREATE_FAILED = "No se pudo crear la alerta en la base de datos"
ERROR_ALERT_LIMIT_EXCEEDED = "El usuario ha alcanzado el limite maximo de 20 alertas activas"
ERROR_INVALID_RSS_CHANNELS = "Algunos canales RSS especificados no existen"
ERROR_INVALID_CATEGORY = "Invalid category"
ERROR_INCONSISTENT_CATEGORY = "Category label does not match IPTC code"
ERROR_DUPLICATE_ALERT_NAME = "Alert name already exists for this user"
MAX_ALERTS_PER_USER = 20


# Mapa canónico IPTC code -> label oficial (alineado con seed_iptc_categories_and_channels).
_IPTC_CANONICAL_LABELS = {
    "01000000": "artes, cultura, entretenimiento y medios",
    "02000000": "policía y justicia",
    "03000000": "catástrofes y accidentes",
    "04000000": "economía, negocios y finanzas",
    "04010000": "tecnología",
    "05000000": "educación",
    "06000000": "medio ambiente",
    "07000000": "salud",
    "08000000": "interés humano, animales, insólito",
    "09000000": "mano de obra",
    "10000000": "estilo de vida y tiempo libre",
    "11000000": "política",
    "12000000": "religión",
    "13000000": "ciencia",
    "14000000": "sociedad",
    "15000000": "deportes",
    "16000000": "conflicto, guerra y paz",
    "17000000": "meteorología",
    "00000000": "otros",
}


def _validate_iptc_label_consistency(categories) -> None:
    """Valida que el `label` coincida con el code oficial IPTC."""
    if not categories:
        return
    for cat in categories:
        if isinstance(cat, dict):
            code = cat.get("code")
            label = cat.get("label")
        else:
            code = getattr(cat, "code", None)
            label = getattr(cat, "label", None)
        if not code or label is None:
            continue
        canonical = _IPTC_CANONICAL_LABELS.get(code)
        if canonical is None:
            continue
        if str(label).strip().lower() != canonical.lower():
            raise HTTPException(
                status_code=400, detail=ERROR_INCONSISTENT_CATEGORY
            )


def _validate_categories(db: Session, categories) -> None:
    """Lanza HTTPException 400 si alguna categoría no existe."""
    codes = _extract_category_codes(categories)
    if not codes:
        return
    valid_codes = {c.value for c in CategoriaIPTC}
    unknown = [c for c in codes if c not in valid_codes]
    if not unknown:
        return
    try:
        from sqlalchemy import text

        rows = db.execute(
            text(
                "SELECT name FROM categories WHERE name LIKE ANY(:patterns)"
            ),
            {"patterns": [f"{code}:%" for code in unknown]},
        ).fetchall()
        found_codes = {row[0].split(":", 1)[0] for row in rows if row and row[0]}
        unknown = [c for c in unknown if c not in found_codes]
    except Exception:
        pass
    if unknown:
        raise HTTPException(status_code=400, detail=ERROR_INVALID_CATEGORY)


def _validate_rss_channels(db: Session, rss_channel_ids) -> None:
    """Verifica que todos los IDs de canal RSS existan.

    Lanza HTTPException 400 (`ERROR_INVALID_RSS_CHANNELS`) si alguno de los
    canales no existe en la base de datos.
    """
    if not rss_channel_ids:
        return
    found = db.query(RSSChannel).filter(RSSChannel.id.in_(rss_channel_ids)).all()
    if len(found) != len(set(rss_channel_ids)):
        raise HTTPException(status_code=400, detail=ERROR_INVALID_RSS_CHANNELS)


def _resolve_channels_from_categories(db: Session, categories) -> list[str]:
    codes = _extract_category_codes(categories)
    if not codes:
        return []
    channels = (
        db.query(RSSChannel)
        .filter(RSSChannel.iptc_category.in_(codes))
        .filter(RSSChannel.is_active.is_(True))
        .all()
    )
    return [str(c.id) for c in channels]


def _apply_simple_alert_fields(db_alert: AlertRule, update_data: dict) -> None:
    """Asigna los campos planos del payload sobre la entidad."""
    simple_fields = (
        "name",
        "descriptors",
        "cron_expression",
        "notify_inbox",
        "notify_email",
    )
    for field in simple_fields:
        if field in update_data:
            setattr(db_alert, field, update_data[field])

    if "categories" in update_data:
        db_alert.categories = [
            item.model_dump() if hasattr(item, "model_dump") else item
            for item in update_data["categories"]
        ]


def _apply_rss_channels_update(
    db: Session, db_alert: AlertRule, update_data: dict
) -> None:
    """Aplica los cambios de canales RSS según el payload de actualización."""
    if "rss_channels_ids" in update_data:
        new_ids = update_data["rss_channels_ids"]
        if new_ids is None:
            db_alert.rss_channel_ids = _resolve_channels_from_categories(
                db, db_alert.categories
            )
        else:
            _validate_rss_channels(db, new_ids)
            db_alert.rss_channel_ids = new_ids
    elif "information_sources_ids" in update_data:
        db_alert.rss_channel_ids = update_data["information_sources_ids"] or []


def _extract_category_codes(categories) -> List[str]:
    codes: List[str] = []
    if not categories:
        return codes
    for cat in categories:
        try:
            if isinstance(cat, dict):
                code = cat.get("code")
            else:
                code = getattr(cat, "code", None)
        except Exception:
            continue
        if isinstance(code, str) and code:
            codes.append(code)
    return codes


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
            rss_channels_ids=item.rss_channel_ids or [],
            information_sources_ids=item.rss_channel_ids or [],
            cron_expression=item.cron_expression,
            notify_inbox=item.notify_inbox,
            notify_email=item.notify_email,
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
    if payload.descriptors and len(payload.descriptors) != len(set(payload.descriptors)):
        raise HTTPException(status_code=400, detail="Descriptores duplicados no permitidos")

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

    _validate_categories(db, payload.categories)
    _validate_iptc_label_consistency(payload.categories)

    normalized_name = (payload.name or "").strip().lower()
    if normalized_name:
        existing = (
            db.query(AlertRule)
            .filter(
                AlertRule.user_id == user_id,
                AlertRule.is_active.is_(True),
            )
            .all()
        )
        for alert in existing:
            if (alert.name or "").strip().lower() == normalized_name:
                raise HTTPException(
                    status_code=409, detail=ERROR_DUPLICATE_ALERT_NAME
                )

    sources_ids = (
        payload.rss_channels_ids
        or payload.information_sources_ids
        or []
    )
    if not sources_ids:
        codes = _extract_category_codes(payload.categories)
        if codes:
            channels = (
                db.query(RSSChannel)
                .filter(RSSChannel.iptc_category.in_(codes))
                .filter(RSSChannel.is_active.is_(True))
                .all()
            )
            sources_ids = [str(c.id) for c in channels]
    else:
        _validate_rss_channels(db, sources_ids)
    db_alert = AlertRule(
        user_id=user_id,
        name=payload.name,
        descriptors=payload.descriptors,
        categories=[category.model_dump() for category in payload.categories],
        rss_channel_ids=sources_ids,
        cron_expression=payload.cron_expression,
        is_active=True,
        notify_inbox=payload.notify_inbox,
        notify_email=payload.notify_email,
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
        rss_channels_ids=db_alert.rss_channel_ids or [],
        information_sources_ids=db_alert.rss_channel_ids or [],
        cron_expression=payload.cron_expression,
        notify_inbox=db_alert.notify_inbox,
        notify_email=db_alert.notify_email,
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
        rss_channels_ids=db_alert.rss_channel_ids or [],
        information_sources_ids=db_alert.rss_channel_ids or [],
        cron_expression=db_alert.cron_expression,
        notify_inbox=db_alert.notify_inbox,
        notify_email=db_alert.notify_email,
    )


@api_alerts_router.put(
    "/users/{user_id}/alerts/{alert_id}",
    tags=["alerts"],
    responses={
        400: {"description": "Algún canal RSS especificado no existe"},
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
    if payload.descriptors:
        payload.descriptors = list(dict.fromkeys(payload.descriptors))

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
    if "categories" in update_data:
        _validate_categories(db, update_data["categories"])
        _validate_iptc_label_consistency(update_data["categories"])
    _apply_simple_alert_fields(db_alert, update_data)
    _apply_rss_channels_update(db, db_alert, update_data)

    db.commit()
    db.refresh(db_alert)

    return Alert(
        id=db_alert.id,
        user_id=db_alert.user_id,
        name=db_alert.name,
        descriptors=db_alert.descriptors or [],
        categories=db_alert.categories or [],
        rss_channels_ids=db_alert.rss_channel_ids or [],
        information_sources_ids=db_alert.rss_channel_ids or [],
        cron_expression=db_alert.cron_expression,
        notify_inbox=db_alert.notify_inbox,
        notify_email=db_alert.notify_email,
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
