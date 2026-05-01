"""Este módulo define los endpoints relacionados con la gestión de canales RSS."""

from typing import Annotated, List
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
from app.utils.deps import get_current_gestor, get_current_user


router = APIRouter()

ERROR_SOURCE_NOT_FOUND = "Fuente de información no encontrada"
ERROR_CHANNEL_NOT_FOUND = "Canal RSS no encontrado para la fuente"
ERROR_CHANNEL_CREATE_FAILED = "No se pudo crear el canal RSS"
ERROR_CHANNEL_CONFLICT = "Canal RSS duplicado o inválido para la fuente"
ERROR_CHANNEL_UPDATE_CONFLICT = "No se pudo actualizar el canal RSS por conflicto de datos"


@router.post(
    "/rss-channels",
    status_code=status.HTTP_201_CREATED,
    tags=["rss-channels"],
    dependencies=[Depends(get_current_gestor)],
    responses={
        400: {"description": "Bad Request"},
        409: {"description": "Conflict"},
        500: {"description": "Internal Server Error"},
    },
)
def crear_canal_rss(
    rss_in: RSSChannelCreate,
    db: Annotated[Session, Depends(get_db)],
) -> RSSChannelResponse:
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
            detail=f"{ERROR_CHANNEL_CREATE_FAILED}: {str(e)}",
        ) from e


@router.get(
    "/rss-channels",
    dependencies=[Depends(get_current_user)],
    tags=["rss-channels"],
)
def listar_canales_rss(
    db: Annotated[Session, Depends(get_db)],
    skip: int = 0,
    limit: int = 100,
) -> List[RSSChannel]:
    """Obtiene todos los canales RSS registrados."""
    canales = get_all_rss_channels(db, skip=skip, limit=limit)
    return [
        RSSChannel(
            id=canal.id,
            information_source_id=canal.information_source_id,
            url=canal.url,
            category_id=canal.category_id or 0,
            iptc_category=canal.iptc_category,
            media_name=canal.media_name,
        )
        for canal in canales
    ]


@router.post(
    "/information-sources/{source_id}/rss-channels",
    status_code=201,
    tags=["rss-channels"],
    dependencies=[Depends(get_current_gestor)],
    responses={
        404: {"description": "Fuente de información no encontrada"},
        409: {"description": "Conflict"},
    },
)
def create_source_channel(
    source_id: int,
    payload: RSSChannelCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
) -> RSSChannel:
    source = (
        db.query(DBInformationSource)
        .filter(DBInformationSource.id == source_id)
        .first()
    )
    if source is None:
        raise HTTPException(status_code=404, detail=ERROR_SOURCE_NOT_FOUND)

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
            detail=ERROR_CHANNEL_CONFLICT,
        ) from exc

    db.refresh(channel)
    return RSSChannel(
        id=channel.id,
        information_source_id=channel.information_source_id,
        url=channel.url,
        category_id=channel.category_id or 0,
        iptc_category=channel.iptc_category,
        media_name=channel.media_name,
    )


@router.get(
    "/information-sources/{source_id}/rss-channels",
    tags=["rss-channels"],
    responses={404: {"description": "Fuente de información no encontrada"}},
)
def list_source_channels(
    source_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
) -> List[RSSChannel]:
    source = (
        db.query(DBInformationSource)
        .filter(DBInformationSource.id == source_id)
        .first()
    )
    if source is None:
        raise HTTPException(status_code=404, detail=ERROR_SOURCE_NOT_FOUND)

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
            iptc_category=channel.iptc_category,
            media_name=channel.media_name,
        )
        for channel in channels
    ]


@router.get(
    "/information-sources/{source_id}/rss-channels/{channel_id}",
    tags=["rss-channels"],
    responses={404: {"description": "Canal RSS no encontrado para la fuente"}},
)
def get_source_channel(
    source_id: int,
    channel_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
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
        raise HTTPException(status_code=404, detail=ERROR_CHANNEL_NOT_FOUND)

    return RSSChannel(
        id=channel.id,
        information_source_id=channel.information_source_id,
        url=channel.url,
        category_id=channel.category_id or 0,
        iptc_category=channel.iptc_category,
        media_name=channel.media_name,
    )


@router.put(
    "/information-sources/{source_id}/rss-channels/{channel_id}",
    tags=["rss-channels"],
    dependencies=[Depends(get_current_gestor)],
    responses={
        404: {"description": "Canal RSS no encontrado para la fuente"},
        409: {"description": "Conflict"},
    },
)
def update_source_channel(
    source_id: int,
    channel_id: int,
    payload: RSSChannelUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
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
        raise HTTPException(status_code=404, detail=ERROR_CHANNEL_NOT_FOUND)

    update_data = payload.model_dump(exclude_unset=True)
    if "category_id" in update_data:
        channel.category_id = update_data["category_id"]
    if "iptc_category" in update_data:
        channel.iptc_category = update_data["iptc_category"]
    if "url" in update_data:
        channel.url = str(update_data["url"])

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=ERROR_CHANNEL_UPDATE_CONFLICT,
        ) from exc

    db.refresh(channel)
    return RSSChannel(
        id=channel.id,
        information_source_id=channel.information_source_id,
        url=channel.url,
        category_id=channel.category_id or 0,
        iptc_category=channel.iptc_category,
        media_name=channel.media_name,
    )


@router.delete(
    "/information-sources/{source_id}/rss-channels/{channel_id}",
    status_code=204,
    response_class=Response,
    tags=["rss-channels"],
    dependencies=[Depends(get_current_gestor)],
    responses={404: {"description": "Canal RSS no encontrado para la fuente"}},
)
def delete_source_channel(
    source_id: int,
    channel_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
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
        raise HTTPException(status_code=404, detail=ERROR_CHANNEL_NOT_FOUND)

    db.delete(channel)
    db.commit()
