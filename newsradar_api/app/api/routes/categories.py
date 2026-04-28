from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Response
from app.schemas.category import Category, CategoryCreate, CategoryUpdate
from app.schemas.user import UserInDB
from app.stores.memory import categories_store, rss_channels_store
from app.utils.deps import get_current_user
from app.core.iptc_categories import IPTC_FIRST_LEVEL, VALID_IPTC_CODES


categories_router = APIRouter()

CurrentUser = Annotated[UserInDB, Depends(get_current_user)]

ERROR_CATEGORY_NOT_FOUND = "Categoría no encontrada"
ERROR_INVALID_IPTC_CODE = "Código IPTC no válido"
ERROR_CATEGORY_LINKED_TO_CHANNELS = "Categoría asociada a canales RSS"


@categories_router.get("/iptc-categories", tags=["categories"])
def list_iptc_categories():
    return [{"code": code, "label": label} for code, label in IPTC_FIRST_LEVEL.items()]


@categories_router.get("/categories", tags=["categories"])
def list_categories(_: CurrentUser) -> List[Category]:
    """Obtiene todas las categorías disponibles (IPTC)."""
    # Primero devuelve cualquier categoría custom creada por el usuario
    custom_categories = list(categories_store.values())
    
    # Luego devuelve las categorías IPTC predefinidas como fallback
    iptc_categories = [
        Category(
            id=idx + 1000,  # IDs altos para las categorías IPTC
            name=label,
            source="IPTC",
            iptc_code=code,
            iptc_label=label,
        )
        for idx, (code, label) in enumerate(IPTC_FIRST_LEVEL.items())
    ]
    
    return custom_categories + iptc_categories


@categories_router.post(
    "/categories",
    status_code=201,
    tags=["categories"],
    responses={422: {"description": "Código IPTC no válido"}},
)
def create_category(payload: CategoryCreate, _: CurrentUser) -> Category:
    if payload.iptc_code is not None and payload.iptc_code not in VALID_IPTC_CODES:
        raise HTTPException(status_code=422, detail=ERROR_INVALID_IPTC_CODE)
    category_id = max(categories_store.keys(), default=0) + 1
    category = Category(id=category_id, **payload.model_dump())
    categories_store[category_id] = category
    return category


@categories_router.get(
    "/categories/{category_id}",
    tags=["categories"],
    responses={404: {"description": "Categoría no encontrada"}},
)
def get_category(category_id: int, _: CurrentUser) -> Category:
    category = categories_store.get(category_id)
    if not category:
        raise HTTPException(status_code=404, detail=ERROR_CATEGORY_NOT_FOUND)
    return category


@categories_router.put(
    "/categories/{category_id}",
    tags=["categories"],
    responses={
        404: {"description": "Categoría no encontrada"},
        409: {"description": "Conflict"},
        422: {"description": "Código IPTC no válido"},
    },
)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    _: CurrentUser,
) -> Category:
    category = categories_store.get(category_id)
    if not category:
        raise HTTPException(status_code=404, detail=ERROR_CATEGORY_NOT_FOUND)
    if payload.iptc_code is not None and payload.iptc_code not in VALID_IPTC_CODES:
        raise HTTPException(status_code=422, detail=ERROR_INVALID_IPTC_CODE)
    updated = category.model_copy(update=payload.model_dump(exclude_unset=True))
    categories_store[category_id] = updated
    return updated


@categories_router.delete(
    "/categories/{category_id}",
    status_code=204,
    response_class=Response,
    tags=["categories"],
    responses={
        404: {"description": "Categoría no encontrada"},
        409: {"description": "Conflict"},
    },
)
def delete_category(category_id: int, _: CurrentUser) -> None:
    if category_id not in categories_store:
        raise HTTPException(status_code=404, detail=ERROR_CATEGORY_NOT_FOUND)
    for channel in rss_channels_store.values():
        if channel.category_id == category_id:
            raise HTTPException(
                status_code=409, detail=ERROR_CATEGORY_LINKED_TO_CHANNELS
            )
    categories_store.pop(category_id, None)
