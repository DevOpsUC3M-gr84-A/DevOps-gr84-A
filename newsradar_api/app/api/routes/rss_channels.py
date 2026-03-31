"""Este módulo define los endpoints relacionados con la gestión de canales RSS."""

from typing import List
from fastapi import APIRouter, Depends, Response, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.rss import (
    RSSChannel,
    RSSChannelCreate,
    RSSChannelUpdate,
    RSSChannelResponse,
)
from app.schemas.user import UserInDB
from app.stores.memory import rss_channels_store
from app.database.database import get_db
from app.services.rss_service import create_rss_channel, get_all_rss_channels
from app.api.dependencies import get_current_gestor, get_current_user
from app.utils.deps import get_current_user
from app.utils.rss_utils import (
    ensure_information_source_exists,
    ensure_category_exists,
    ensure_rss_for_source,
    next_id,
)

API_PREFIX = "/api/v1"

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
        # Aquí podrías capturar IntegrateError si la URL ya existe en BD, por ejemplo
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
    """
    Obtiene todos los canales RSS registrados.
    Este endpoint sí es accesible por Lectores, el control de acceso es solo de creación.
    """
    canales = get_all_rss_channels(db, skip=skip, limit=limit)
    return canales


@router.get(
    f"{API_PREFIX}/information-sources/{{source_id}}/rss-channels",
    response_model=List[RSSChannel],
    tags=["rss-channels"],
)
def list_source_channels(
    source_id: int, _: UserInDB = Depends(get_current_user)
) -> List[RSSChannel]:
    ensure_information_source_exists(source_id)
    return [
        channel
        for channel in rss_channels_store.values()
        if channel.information_source_id == source_id
    ]


@router.post(
    f"{API_PREFIX}/information-sources/{{source_id}}/rss-channels",
    response_model=RSSChannel,
    status_code=201,
    tags=["rss-channels"],
)
def create_source_channel(
    source_id: int,
    payload: RSSChannelCreate,
    _: UserInDB = Depends(get_current_user),
) -> RSSChannel:
    ensure_information_source_exists(source_id)
    ensure_category_exists(payload.category_id)

    channel_id = next_id("rss_channels")
    channel = RSSChannel(
        id=channel_id,
        information_source_id=source_id,
        **payload.model_dump(),
    )
    rss_channels_store[channel_id] = channel
    return channel


@router.get(
    f"{API_PREFIX}/information-sources/{{source_id}}/rss-channels/{{channel_id}}",
    response_model=RSSChannel,
    tags=["rss-channels"],
)
def get_source_channel(
    source_id: int,
    channel_id: int,
    _: UserInDB = Depends(get_current_user),
) -> RSSChannel:
    ensure_information_source_exists(source_id)
    return ensure_rss_for_source(source_id, channel_id)


@router.put(
    f"{API_PREFIX}/information-sources/{{source_id}}/rss-channels/{{channel_id}}",
    response_model=RSSChannel,
    tags=["rss-channels"],
)
def update_source_channel(
    source_id: int,
    channel_id: int,
    payload: RSSChannelUpdate,
    _: UserInDB = Depends(get_current_user),
) -> RSSChannel:
    ensure_information_source_exists(source_id)
    channel = ensure_rss_for_source(source_id, channel_id)

    update_data = payload.model_dump(exclude_unset=True)
    if "category_id" in update_data:
        ensure_category_exists(update_data["category_id"])

    updated = channel.model_copy(update=update_data)
    rss_channels_store[channel_id] = updated
    return updated


@router.delete(
    f"{API_PREFIX}/information-sources/{{source_id}}/rss-channels/{{channel_id}}",
    status_code=204,
    response_model=None,
    response_class=Response,
    tags=["rss-channels"],
)
def delete_source_channel(
    source_id: int,
    channel_id: int,
    _: UserInDB = Depends(get_current_user),
) -> None:
    ensure_information_source_exists(source_id)
    ensure_rss_for_source(source_id, channel_id)
    rss_channels_store.pop(channel_id, None)
