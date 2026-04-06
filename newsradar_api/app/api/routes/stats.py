from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Response
from app.schemas.stats import Stats, StatsCreate, StatsUpdate
from app.schemas.user import UserInDB
from app.stores.memory import stats_store
from app.utils.deps import get_current_user

stats_router = APIRouter()


@stats_router.get("/stats", tags=["stats"])
def list_stats(_: Annotated[UserInDB, Depends(get_current_user)] = None) -> List[Stats]:
    return list(stats_store.values())


@stats_router.post("/stats", status_code=201, tags=["stats"])
def create_stats(
    payload: StatsCreate,
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
) -> Stats:
    stats_id = max(stats_store.keys(), default=0) + 1
    stats = Stats(id=stats_id, **payload.model_dump())
    stats_store[stats_id] = stats
    return stats


@stats_router.get(
    "/stats/{stats_id}",
    tags=["stats"],
    responses={404: {"description": "Stats no encontrados"}},
)
def get_stats(stats_id: int, _: Annotated[UserInDB, Depends(get_current_user)] = None) -> Stats:
    stats = stats_store.get(stats_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Stats no encontrados")
    return stats


@stats_router.put(
    "/stats/{stats_id}",
    tags=["stats"],
    responses={404: {"description": "Stats no encontrados"}},
)
def update_stats(
    stats_id: int,
    payload: StatsUpdate,
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
) -> Stats:
    stats = stats_store.get(stats_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Stats no encontrados")
    updated = stats.model_copy(update=payload.model_dump(exclude_unset=True))
    stats_store[stats_id] = updated
    return updated


@stats_router.delete(
    "/stats/{stats_id}",
    status_code=204,
    response_class=Response,
    tags=["stats"],
    responses={404: {"description": "Stats no encontrados"}},
)
def delete_stats(stats_id: int, _: Annotated[UserInDB, Depends(get_current_user)] = None) -> None:
    if stats_id not in stats_store:
        raise HTTPException(status_code=404, detail="Stats no encontrados")
    stats_store.pop(stats_id, None)
