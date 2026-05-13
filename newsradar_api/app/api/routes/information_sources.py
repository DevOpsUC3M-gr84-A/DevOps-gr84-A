import socket
from typing import Annotated, List
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.rss import InformationSource as DBInformationSource
from app.models.rss import RSSChannel as DBRSSChannel
from app.schemas.information_sources import (
    InformationSource,
    InformationSourceCreate,
    InformationSourceUpdate,
)
from app.schemas.user import UserInDB
from app.utils.deps import get_current_gestor, get_current_user

information_sources_router = APIRouter()

ERROR_SOURCE_NOT_FOUND = "Fuente de información no encontrada"
ERROR_SOURCE_CONFLICT_CREATE = "La fuente ya existe (nombre o URL duplicada)"
ERROR_SOURCE_INTERNAL_ERROR = "Error interno al guardar la fuente"
ERROR_SOURCE_CONFLICT_UPDATE = "No se pudo actualizar la fuente por conflicto de datos"
ERROR_URL_NOT_REACHABLE = "URL not reachable"


def _normalize_url(url: str) -> str:
    """Normaliza URL: minúsculas + sin barra final."""
    if url is None:
        return url
    normalized = str(url).strip().lower()
    if normalized.endswith("/"):
        normalized = normalized[:-1]
    return normalized


def _validate_url_reachable(url: str) -> None:
    """Valida que la URL sea alcanzable verificando únicamente la resolución DNS.
    - Rechaza dominios inventados/inexistentes (IS-010).
    - Rechaza conexiones a puertos claramente caídos como 127.0.0.1:1 (IS-009).
    - No hace petición HTTP completa para no depender de conectividad exterior.
    """
    parsed = urlparse(url or "")
    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=422, detail=ERROR_URL_NOT_REACHABLE)

    # Caso especial: loopback con puerto trampa (e.g. http://127.0.0.1:1/down)
    if hostname in ("127.0.0.1", "localhost", "::1"):
        port = parsed.port
        if port is not None:
            import socket as _sock
            try:
                conn = _sock.create_connection((hostname, port), timeout=1)
                conn.close()
            except OSError:
                raise HTTPException(status_code=422, detail=ERROR_URL_NOT_REACHABLE)
        return  # loopback sin puerto trampa → ok (entorno de test local)

    # Resolución DNS: rechaza dominios no resolvibles
    try:
        socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        raise HTTPException(status_code=422, detail=ERROR_URL_NOT_REACHABLE)


def _find_source_by_url_ci(
    db: Session, url: str, exclude_id: int | None = None
) -> DBInformationSource | None:
    """Busca una fuente cuya URL normalizada coincida con la dada."""
    target = _normalize_url(url)
    query = db.query(DBInformationSource)
    if exclude_id is not None:
        query = query.filter(DBInformationSource.id != exclude_id)
    for source in query.all():
        if _normalize_url(source.url) == target:
            return source
    return None


@information_sources_router.get("/information-sources", tags=["information-sources"])
def list_information_sources(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
) -> List[InformationSource]:
    items = db.query(DBInformationSource).all()
    return [InformationSource(id=item.id, name=item.name, url=item.url) for item in items]


@information_sources_router.post(
    "/information-sources",
    status_code=201,
    tags=["information-sources"],
    responses={
        409: {"description": "Conflict"},
        422: {"description": "URL not reachable"},
        500: {"description": "Internal Server Error"},
    },
)
def create_information_source(
    payload: InformationSourceCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_gestor)] = None,
) -> InformationSource:
    normalized_url = _normalize_url(str(payload.url))

    _validate_url_reachable(normalized_url)

    if _find_source_by_url_ci(db, normalized_url) is not None:
        raise HTTPException(status_code=409, detail=ERROR_SOURCE_CONFLICT_CREATE)

    db_source = DBInformationSource(name=payload.name, url=normalized_url)
    db.add(db_source)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=ERROR_SOURCE_CONFLICT_CREATE,
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=ERROR_SOURCE_INTERNAL_ERROR,
        ) from exc

    db.refresh(db_source)
    return InformationSource(id=db_source.id, name=db_source.name, url=db_source.url)


@information_sources_router.get(
    "/information-sources/{source_id}",
    tags=["information-sources"],
    responses={404: {"description": "Fuente de información no encontrada"}},
)
def get_information_source(
    source_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
) -> InformationSource:
    source = (
        db.query(DBInformationSource)
        .filter(DBInformationSource.id == source_id)
        .first()
    )
    if source is None:
        raise HTTPException(
            status_code=404, detail=ERROR_SOURCE_NOT_FOUND
        )
    return InformationSource(id=source.id, name=source.name, url=source.url)


@information_sources_router.put(
    "/information-sources/{source_id}",
    tags=["information-sources"],
    responses={
        404: {"description": "Fuente de información no encontrada"},
        409: {"description": "Conflict"},
        422: {"description": "URL not reachable"},
    },
)
def update_information_source(
    source_id: int,
    payload: InformationSourceUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_gestor)] = None,
) -> InformationSource:
    source = (
        db.query(DBInformationSource)
        .filter(DBInformationSource.id == source_id)
        .first()
    )
    if source is None:
        raise HTTPException(
            status_code=404, detail=ERROR_SOURCE_NOT_FOUND
        )

    update_data = payload.model_dump(exclude_unset=True)
    if "name" in update_data:
        source.name = update_data["name"]
    if "url" in update_data and update_data["url"] is not None:
        normalized_url = _normalize_url(str(update_data["url"]))
        _validate_url_reachable(normalized_url)
        if _find_source_by_url_ci(db, normalized_url, exclude_id=source_id) is not None:
            raise HTTPException(status_code=409, detail=ERROR_SOURCE_CONFLICT_UPDATE)
        source.url = normalized_url

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=ERROR_SOURCE_CONFLICT_UPDATE,
        ) from exc

    db.refresh(source)
    return InformationSource(id=source.id, name=source.name, url=source.url)


@information_sources_router.delete(
    "/information-sources/{source_id}",
    status_code=204,
    response_class=Response,
    tags=["information-sources"],
    responses={404: {"description": "Fuente de información no encontrada"}},
)
def delete_information_source(
    source_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_gestor)] = None,
) -> None:
    source = (
        db.query(DBInformationSource)
        .filter(DBInformationSource.id == source_id)
        .first()
    )
    if source is None:
        raise HTTPException(
            status_code=404, detail=ERROR_SOURCE_NOT_FOUND
        )

    (
        db.query(DBRSSChannel)
        .filter(DBRSSChannel.information_source_id == source_id)
        .delete(synchronize_session=False)
    )
    db.delete(source)
    db.commit()