from fastapi import APIRouter, Depends, HTTPException, Response
from typing import List
from app.schemas.category import Category, CategoryCreate, CategoryUpdate
from app.schemas.user import UserInDB
from app.stores.memory import categories_store, rss_channels_store
from app.utils.deps import get_current_user

categories_router = APIRouter()
API_PREFIX = "/api/v1"


@categories_router.get(
    f"{API_PREFIX}/categories", response_model=List[Category], tags=["categories"]
)
def list_categories(_: UserInDB = Depends(get_current_user)) -> List[Category]:
    return list(categories_store.values())


@categories_router.post(
    f"{API_PREFIX}/categories",
    response_model=Category,
    status_code=201,
    tags=["categories"],
)
def create_category(
    payload: CategoryCreate, _: UserInDB = Depends(get_current_user)
) -> Category:
    category_id = max(categories_store.keys(), default=0) + 1
    category = Category(id=category_id, **payload.model_dump())
    categories_store[category_id] = category
    return category


@categories_router.get(
    f"{API_PREFIX}/categories/{{category_id}}",
    response_model=Category,
    tags=["categories"],
)
def get_category(category_id: int, _: UserInDB = Depends(get_current_user)) -> Category:
    category = categories_store.get(category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return category


@categories_router.put(
    f"{API_PREFIX}/categories/{{category_id}}",
    response_model=Category,
    tags=["categories"],
)
def update_category(
    category_id: int, payload: CategoryUpdate, _: UserInDB = Depends(get_current_user)
) -> Category:
    category = categories_store.get(category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    updated = category.model_copy(update=payload.model_dump(exclude_unset=True))
    categories_store[category_id] = updated
    return updated


@categories_router.delete(
    f"{API_PREFIX}/categories/{{category_id}}",
    status_code=204,
    response_model=None,
    response_class=Response,
    tags=["categories"],
)
def delete_category(category_id: int, _: UserInDB = Depends(get_current_user)) -> None:
    if category_id not in categories_store:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    for channel in rss_channels_store.values():
        if channel.category_id == category_id:
            raise HTTPException(
                status_code=409, detail="Categoría asociada a canales RSS"
            )
    categories_store.pop(category_id, None)
