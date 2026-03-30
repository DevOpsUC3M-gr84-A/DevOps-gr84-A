from typing import List
from fastapi import APIRouter, Depends, HTTPException, Response
from app.schemas.information_sources import (
    InformationSource,
    InformationSourceCreate,
    InformationSourceUpdate,
)
from app.schemas.user import UserInDB
from app.stores.memory import information_sources_store, rss_channels_store
from app.utils.deps import get_current_user

information_sources_router = APIRouter()
API_PREFIX = "/api/v1"


@information_sources_router.get(
    f"{API_PREFIX}/information-sources",
    response_model=List[InformationSource],
    tags=["information-sources"],
)
def list_information_sources(
    _: UserInDB = Depends(get_current_user),
) -> List[InformationSource]:
    return list(information_sources_store.values())


@information_sources_router.post(
    f"{API_PREFIX}/information-sources",
    response_model=InformationSource,
    status_code=201,
    tags=["information-sources"],
)
def create_information_source(
    payload: InformationSourceCreate, _: UserInDB = Depends(get_current_user)
) -> InformationSource:
    source_id = max(information_sources_store.keys(), default=0) + 1
    source = InformationSource(id=source_id, **payload.model_dump())
    information_sources_store[source_id] = source
    return source


@information_sources_router.get(
    f"{API_PREFIX}/information-sources/{{source_id}}",
    response_model=InformationSource,
    tags=["information-sources"],
)
def get_information_source(
    source_id: int, _: UserInDB = Depends(get_current_user)
) -> InformationSource:
    source = information_sources_store.get(source_id)
    if not source:
        raise HTTPException(
            status_code=404, detail="Fuente de información no encontrada"
        )
    return source


@information_sources_router.put(
    f"{API_PREFIX}/information-sources/{{source_id}}",
    response_model=InformationSource,
    tags=["information-sources"],
)
def update_information_source(
    source_id: int,
    payload: InformationSourceUpdate,
    _: UserInDB = Depends(get_current_user),
) -> InformationSource:
    source = information_sources_store.get(source_id)
    if not source:
        raise HTTPException(
            status_code=404, detail="Fuente de información no encontrada"
        )
    updated = source.model_copy(update=payload.model_dump(exclude_unset=True))
    information_sources_store[source_id] = updated
    return updated


@information_sources_router.delete(
    f"{API_PREFIX}/information-sources/{{source_id}}",
    status_code=204,
    response_model=None,
    response_class=Response,
    tags=["information-sources"],
)
def delete_information_source(
    source_id: int, _: UserInDB = Depends(get_current_user)
) -> None:
    if source_id not in information_sources_store:
        raise HTTPException(
            status_code=404, detail="Fuente de información no encontrada"
        )
    channel_ids = [
        channel.id
        for channel in rss_channels_store.values()
        if channel.information_source_id == source_id
    ]
    for channel_id in channel_ids:
        rss_channels_store.pop(channel_id, None)
    information_sources_store.pop(source_id, None)
