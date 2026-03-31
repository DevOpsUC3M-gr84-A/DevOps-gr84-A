from fastapi import APIRouter, Depends, HTTPException, Response
from typing import List
from app.schemas.stats import Stats, StatsCreate, StatsUpdate
from app.schemas.user import UserInDB
from app.stores.memory import stats_store
from app.utils.deps import get_current_user

stats_router = APIRouter()


@stats_router.get(f"/stats", response_model=List[Stats], tags=["stats"])
def list_stats(_: UserInDB = Depends(get_current_user)) -> List[Stats]:
    return list(stats_store.values())


@stats_router.post(f"/stats", response_model=Stats, status_code=201, tags=["stats"])
def create_stats(
    payload: StatsCreate, _: UserInDB = Depends(get_current_user)
) -> Stats:
    stats_id = max(stats_store.keys(), default=0) + 1
    stats = Stats(id=stats_id, **payload.model_dump())
    stats_store[stats_id] = stats
    return stats


@stats_router.get(f"/stats/{{stats_id}}", response_model=Stats, tags=["stats"])
def get_stats(stats_id: int, _: UserInDB = Depends(get_current_user)) -> Stats:
    stats = stats_store.get(stats_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Stats no encontrados")
    return stats


@stats_router.put(f"/stats/{{stats_id}}", response_model=Stats, tags=["stats"])
def update_stats(
    stats_id: int, payload: StatsUpdate, _: UserInDB = Depends(get_current_user)
) -> Stats:
    stats = stats_store.get(stats_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Stats no encontrados")
    updated = stats.model_copy(update=payload.model_dump(exclude_unset=True))
    stats_store[stats_id] = updated
    return updated


@stats_router.delete(
    f"/stats/{{stats_id}}",
    status_code=204,
    response_model=None,
    response_class=Response,
    tags=["stats"],
)
def delete_stats(stats_id: int, _: UserInDB = Depends(get_current_user)) -> None:
    if stats_id not in stats_store:
        raise HTTPException(status_code=404, detail="Stats no encontrados")
    stats_store.pop(stats_id, None)
