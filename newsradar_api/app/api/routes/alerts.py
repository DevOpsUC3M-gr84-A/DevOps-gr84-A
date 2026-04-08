from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.alert_monitoring import AlertRule
from app.models.user import User as DBUser
from app.schemas.alert import Alert, AlertCreate, AlertUpdate
from app.schemas.user import UserInDB
from app.utils.deps import get_current_gestor, get_current_user


api_alerts_router = APIRouter()

ERROR_USER_NOT_FOUND = "Usuario no encontrado"
ERROR_ALERT_NOT_FOUND = "Alerta no encontrada para el usuario"
ERROR_ALERT_CREATE_FAILED = "No se pudo crear la alerta en la base de datos"
ERROR_ALERT_LIMIT_REACHED = "El gestor ya alcanzó el máximo de 20 alertas activas"
MAX_ALERTS_PER_MANAGER = 20


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

    active_alerts_count = (
        db.query(AlertRule)
        .filter(AlertRule.user_id == user_id, AlertRule.is_active.is_(True))
        .count()
    )
    if active_alerts_count >= MAX_ALERTS_PER_MANAGER:
        raise HTTPException(status_code=400, detail=ERROR_ALERT_LIMIT_REACHED)

    db_alert = AlertRule(
        user_id=user_id,
        name=payload.name,
        descriptors=payload.descriptors,
        categories=[category.model_dump() for category in payload.categories],
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
        cron_expression=db_alert.cron_expression,
    )


@api_alerts_router.put(
    "/users/{user_id}/alerts/{alert_id}",
    tags=["alerts"],
    responses={404: {"description": "Not found"}},
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
