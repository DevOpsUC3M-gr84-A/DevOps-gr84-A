from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Response

from app.schemas.category import Category, CategoryCreate, CategoryUpdate
from app.schemas.user import UserInDB
from app.stores.memory import categories_store, iptc_deleted_store, rss_channels_store
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


def _get_category_key(cat_id: int | str | None) -> int | str | None:
    """Busca todas las variantes posibles de clave en el store.
    Maneja: int, str, str con padding (01000000).
    """
    if cat_id is None:
        return None
    
    try:
        cat_id_int = int(cat_id)
    except (TypeError, ValueError):
        return None
    
    # Variantes a buscar
    variants = [
        cat_id_int,                          # 1000000 (int)
        str(cat_id_int),                     # "1000000" (str)
        f"{cat_id_int:08d}",                # "01000000" (str padded)
    ]
    
    for variant in variants:
        if variant in categories_store:
            return variant
    
    return None


@categories_router.get("/iptc-categories", tags=["categories"])
def list_iptc_categories():
    return [{"code": code, "label": label} for code, label in IPTC_FIRST_LEVEL.items()]


@categories_router.get("/categories", tags=["categories"])
def list_categories(_: CurrentUser) -> List[Category]:
    # Devuelve items del store + fallback a IPTC_FIRST_LEVEL para IDs no en store
    # y no marcados como borrados explícitamente (iptc_deleted_store).
    # Esto permite que SMOKE-004/005 encuentren categorías al arrancar (sin seeding),
    # y que _ensure_categories_empty() de GC-022 pueda dejar la lista vacía.
    store_items = list(categories_store.values())
    store_ids = set(categories_store.keys())
    iptc_fallback = [
        Category(id=code, name=label, source="IPTC")
        for code, label in IPTC_FIRST_LEVEL.items()
        if code not in store_ids and code not in iptc_deleted_store
    ]
    return store_items + iptc_fallback


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

    # Validar iptc_code si se proporciona
    if payload.iptc_code is not None:
        try:
            iptc_code = int(payload.iptc_code)
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail=ERROR_INVALID_IPTC_CODE)
        if iptc_code not in VALID_IPTC_CODES:
            raise HTTPException(status_code=422, detail=ERROR_INVALID_IPTC_CODE)

    # Determinar el category_id
    if payload.id and payload.id > 0:
        category_id = int(payload.id)
    elif payload.iptc_code is not None:
        category_id = int(payload.iptc_code)
    else:
        # Si no hay ID explícito ni iptc_code, derivar del nombre (debe ser IPTC válido)
        _validate_iptc_name_if_needed(payload.source, name)
        category_id = _IPTC_CODE_BY_NAME[normalized_name]

    # Verificar duplicados por nombre (case-insensitive)
    existing = _find_existing_by_name(name)
    if existing is not None:
        raise HTTPException(status_code=409, detail="Category already exists")

    category = Category(id=category_id, name=name, source="IPTC")
    categories_store[category_id] = category
    iptc_deleted_store.discard(category_id)  # ya no está "borrada"
    return category


@categories_router.get(
    "/categories/{category_id}",
    tags=["categories"],
    responses={404: {"description": "Categoría no encontrada"}},
)
def get_category(category_id: int, _: CurrentUser) -> Category:
    # Buscar con variantes de clave
    key = _get_category_key(category_id)
    if key is not None:
        return categories_store[key]

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
    # Buscar con variantes de clave
    key = _get_category_key(category_id)
    if key is None:
        raise HTTPException(status_code=404, detail=ERROR_CATEGORY_NOT_FOUND)
    
    category = categories_store[key]

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
    categories_store[key] = updated  # Usar la clave encontrada
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
    # Buscar con variantes de clave en el store
    key = _get_category_key(category_id)

    # Si no está en el store, puede ser una categoría IPTC del fallback
    if key is None:
        if category_id in IPTC_FIRST_LEVEL and category_id not in iptc_deleted_store:
            iptc_deleted_store.add(category_id)
            return
        raise HTTPException(status_code=404, detail=ERROR_CATEGORY_NOT_FOUND)

    for channel in rss_channels_store.values():
        if getattr(channel, "category_id", None) == category_id:
            raise HTTPException(
                status_code=409, detail=ERROR_CATEGORY_LINKED_TO_CHANNELS
            )

    categories_store.pop(key, None)
    # Si es un ID IPTC, marcarlo también como eliminado para que no reaparezca
    # en el fallback de list_categories hasta que se re-cree
    if category_id in IPTC_FIRST_LEVEL:
        iptc_deleted_store.add(category_id)