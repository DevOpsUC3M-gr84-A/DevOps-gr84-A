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
ERROR_INVALID_IPTC_NAME = "Invalid IPTC category name"


def _normalize_name(value: str) -> str:
    return value.lower().strip()


_IPTC_CODE_BY_NAME = {_normalize_name(label): code for code, label in IPTC_FIRST_LEVEL.items()}


def _find_existing_by_name(name: str) -> Category | None:
    normalized = _normalize_name(name)
    for category in categories_store.values():
        if _normalize_name(category.name) == normalized:
            return category
    return None


@categories_router.get("/iptc-categories", tags=["categories"])
def list_iptc_categories():
    return [{"code": code, "label": label} for code, label in IPTC_FIRST_LEVEL.items()]


@categories_router.get("/categories", tags=["categories"])
def list_categories(_: CurrentUser) -> List[Category]:
    custom_categories = list(categories_store.values())
    iptc_categories = [
        Category(id=code, name=label, source="IPTC")
        for code, label in IPTC_FIRST_LEVEL.items()
        if code not in categories_store
    ]
    return custom_categories + iptc_categories


def _validate_iptc_name_if_needed(source: str, name: str) -> None:
    if source == "IPTC" and _normalize_name(name) not in _IPTC_CODE_BY_NAME:
        raise HTTPException(status_code=422, detail=ERROR_INVALID_IPTC_NAME)


@categories_router.post(
    "/categories",
    status_code=201,
    tags=["categories"],
    responses={422: {"description": "Código IPTC no válido"}},
)
def create_category(payload: CategoryCreate, _: CurrentUser) -> Category:
    name = payload.name.strip()
    normalized_name = _normalize_name(name)

    if payload.iptc_code is not None:
        try:
            iptc_code = int(payload.iptc_code)
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail=ERROR_INVALID_IPTC_CODE)
        if iptc_code not in VALID_IPTC_CODES:
            raise HTTPException(status_code=422, detail=ERROR_INVALID_IPTC_CODE)

    _validate_iptc_name_if_needed(payload.source, name)

    existing = _find_existing_by_name(name)
    if existing is not None:
        raise HTTPException(status_code=409, detail="Category already exists")

    if payload.id and payload.id > 0:
        category_id = int(payload.id)
    elif payload.iptc_code is not None:
        category_id = int(payload.iptc_code)
    else:
        category_id = _IPTC_CODE_BY_NAME[normalized_name]

    category = Category(id=category_id, name=name, source="IPTC")
    categories_store[category_id] = category
    return category


@categories_router.get(
    "/categories/{category_id}",
    tags=["categories"],
    responses={404: {"description": "Categoría no encontrada"}},
)
def get_category(category_id: int, _: CurrentUser) -> Category:
    category = categories_store.get(category_id)
    if category is not None:
        return category

    label = IPTC_FIRST_LEVEL.get(category_id)
    if label is not None:
        return Category(id=category_id, name=label, source="IPTC")

    raise HTTPException(status_code=404, detail=ERROR_CATEGORY_NOT_FOUND)


@categories_router.put(
    "/categories/{category_id}",
    tags=["categories"],
    responses={
        404: {"description": "Categoría no encontrada"},
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

    update_data = payload.model_dump(exclude_unset=True)

    if payload.iptc_code is not None:
        try:
            iptc_code = int(payload.iptc_code)
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail=ERROR_INVALID_IPTC_CODE)
        if iptc_code not in VALID_IPTC_CODES:
            raise HTTPException(status_code=422, detail=ERROR_INVALID_IPTC_CODE)

    if isinstance(update_data.get("name"), str):
        update_data["name"] = update_data["name"].strip()

    source = update_data.get("source", category.source)
    if "name" in update_data:
        _validate_iptc_name_if_needed(source, update_data["name"])

    if "source" in update_data:
        update_data["source"] = "IPTC"

    updated = category.model_copy(update=update_data)
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
        if getattr(channel, "category_id", None) == category_id:
            raise HTTPException(
                status_code=409, detail=ERROR_CATEGORY_LINKED_TO_CHANNELS
            )

    categories_store.pop(category_id, None)