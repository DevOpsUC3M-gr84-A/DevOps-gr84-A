"""Este módulo define los endpoints relacionados con la gestión de canales RSS."""

from typing import List
from fastapi import APIRouter, Depends, Response, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.rss import InformationSource as DBInformationSource
from app.models.rss import RSSChannel as DBRSSChannel
from app.schemas.rss import (
    RSSChannel,
    RSSChannelCreate,
    RSSChannelUpdate,
    RSSChannelResponse,
)
from app.schemas.user import UserInDB
from app.database.database import get_db
from app.services.rss_service import create_rss_channel, get_all_rss_channels
from app.api.dependencies import get_current_gestor
from app.utils.deps import get_current_user


router = APIRouter()


@router.post(
    "/",
    response_model=RSSChannelResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_gestor)],
)
def crear_canal_rss(rss_in: RSSChannelCreate, db: Session = Depends(get_db)):
    """
    Crea un nuevo canal RSS en el sistema.
    [SOLO GESTORES] - Bloqueado a Lector usando la dependencia get_current_gestor.
    """
    try:
        nuevo_canal = create_rss_channel(db, rss_in)
        return nuevo_canal
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se pudo crear el canal RSS: {str(e)}",
        ) from e


@router.get(
    "/",
    response_model=List[RSSChannelResponse],
    dependencies=[Depends(get_current_user)],
)
def listar_canales_rss(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Obtiene todos los canales RSS registrados."""
    canales = get_all_rss_channels(db, skip=skip, limit=limit)
    return canales


@router.get(
    "/information-sources/{source_id}/rss-channels",
    response_model=List[RSSChannel],
    tags=["rss-channels"],
)
def list_source_channels(
    source_id: int,
    _: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[RSSChannel]:
    source = (
        db.query(DBInformationSource)
        .filter(DBInformationSource.id == source_id)
        .first()
    )
    if source is None:
        raise HTTPException(status_code=404, detail="Fuente de información no encontrada")

    channels = (
        db.query(DBRSSChannel)
        .filter(DBRSSChannel.information_source_id == source_id)
        .all()
    )
    return [
        RSSChannel(
            id=channel.id,
            information_source_id=channel.information_source_id,
            url=channel.url,
            category_id=channel.category_id or 0,
        )
        for channel in channels
    ]


@router.post(
    "/information-sources/{source_id}/rss-channels",
    response_model=RSSChannel,
    status_code=201,
    tags=["rss-channels"],
)
def create_source_channel(
    source_id: int,
    payload: RSSChannelCreate,
    _: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RSSChannel:
    source = (
        db.query(DBInformationSource)
        .filter(DBInformationSource.id == source_id)
        .first()
    )
    if source is None:
        raise HTTPException(status_code=404, detail="Fuente de información no encontrada")

    channel = DBRSSChannel(
        information_source_id=source_id,
        media_name=payload.media_name,
        url=str(payload.url),
        category_id=payload.category_id,
        iptc_category=payload.iptc_category,
        is_active=True,
    )
    db.add(channel)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Canal RSS duplicado o inválido para la fuente",
        ) from exc

    db.refresh(channel)
    return RSSChannel(
        id=channel.id,
        information_source_id=channel.information_source_id,
        url=channel.url,
        category_id=channel.category_id or 0,
    )


@router.get(
    "/information-sources/{source_id}/rss-channels/{channel_id}",
    response_model=RSSChannel,
    tags=["rss-channels"],
)
def get_source_channel(
    source_id: int,
    channel_id: int,
    _: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RSSChannel:
    channel = (
        db.query(DBRSSChannel)
        .filter(
            DBRSSChannel.id == channel_id,
            DBRSSChannel.information_source_id == source_id,
        )
        .first()
    )
    if channel is None:
        raise HTTPException(status_code=404, detail="Canal RSS no encontrado para la fuente")

    return RSSChannel(
        id=channel.id,
        information_source_id=channel.information_source_id,
        url=channel.url,
        category_id=channel.category_id or 0,
    )


@router.put(
    "/information-sources/{source_id}/rss-channels/{channel_id}",
    response_model=RSSChannel,
    tags=["rss-channels"],
)
def update_source_channel(
    source_id: int,
    channel_id: int,
    payload: RSSChannelUpdate,
    _: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RSSChannel:
    channel = (
        db.query(DBRSSChannel)
        .filter(
            DBRSSChannel.id == channel_id,
            DBRSSChannel.information_source_id == source_id,
        )
        .first()
    )
    if channel is None:
        raise HTTPException(status_code=404, detail="Canal RSS no encontrado para la fuente")

    update_data = payload.model_dump(exclude_unset=True)
    if "category_id" in update_data:
        channel.category_id = update_data["category_id"]
    if "url" in update_data:
        channel.url = str(update_data["url"])

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="No se pudo actualizar el canal RSS por conflicto de datos",
        ) from exc

    db.refresh(channel)
    return RSSChannel(
        id=channel.id,
        information_source_id=channel.information_source_id,
        url=channel.url,
        category_id=channel.category_id or 0,
    )


@router.delete(
    "/information-sources/{source_id}/rss-channels/{channel_id}",
    status_code=204,
    response_model=None,
    response_class=Response,
    tags=["rss-channels"],
)
def delete_source_channel(
    source_id: int,
    channel_id: int,
    _: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    channel = (
        db.query(DBRSSChannel)
        .filter(
            DBRSSChannel.id == channel_id,
            DBRSSChannel.information_source_id == source_id,
        )
        .first()
    )
    if channel is None:
        raise HTTPException(status_code=404, detail="Canal RSS no encontrado para la fuente")

    db.delete(channel)
    db.commit()
