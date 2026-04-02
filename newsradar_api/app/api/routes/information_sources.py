from typing import List
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


@information_sources_router.get(
    "/information-sources",
    response_model=List[InformationSource],
    tags=["information-sources"],
)
def list_information_sources(
    _: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[InformationSource]:
    items = db.query(DBInformationSource).all()
    return [InformationSource(id=item.id, name=item.name, url=item.url) for item in items]


@information_sources_router.post(
    "/information-sources",
    response_model=InformationSource,
    status_code=201,
    tags=["information-sources"],
)
def create_information_source(
    payload: InformationSourceCreate,
    _: UserInDB = Depends(get_current_gestor),
    db: Session = Depends(get_db),
) -> InformationSource:
    db_source = DBInformationSource(name=payload.name, url=str(payload.url))
    db.add(db_source)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="La fuente ya existe (nombre o URL duplicada)",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Error interno al guardar la fuente",
        ) from exc

    db.refresh(db_source)
    return InformationSource(id=db_source.id, name=db_source.name, url=db_source.url)


@information_sources_router.get(
    f"/information-sources/{{source_id}}",
    response_model=InformationSource,
    tags=["information-sources"],
)
def get_information_source(
    source_id: int,
    _: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InformationSource:
    source = (
        db.query(DBInformationSource)
        .filter(DBInformationSource.id == source_id)
        .first()
    )
    if source is None:
        raise HTTPException(
            status_code=404, detail="Fuente de información no encontrada"
        )
    return InformationSource(id=source.id, name=source.name, url=source.url)


@information_sources_router.put(
    f"/information-sources/{{source_id}}",
    response_model=InformationSource,
    tags=["information-sources"],
)
def update_information_source(
    source_id: int,
    payload: InformationSourceUpdate,
    _: UserInDB = Depends(get_current_gestor),
    db: Session = Depends(get_db),
) -> InformationSource:
    source = (
        db.query(DBInformationSource)
        .filter(DBInformationSource.id == source_id)
        .first()
    )
    if source is None:
        raise HTTPException(
            status_code=404, detail="Fuente de información no encontrada"
        )

    update_data = payload.model_dump(exclude_unset=True)
    if "name" in update_data:
        source.name = update_data["name"]
    if "url" in update_data:
        source.url = str(update_data["url"])

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="No se pudo actualizar la fuente por conflicto de datos",
        ) from exc

    db.refresh(source)
    return InformationSource(id=source.id, name=source.name, url=source.url)


@information_sources_router.delete(
    f"/information-sources/{{source_id}}",
    status_code=204,
    response_model=None,
    response_class=Response,
    tags=["information-sources"],
)
def delete_information_source(
    source_id: int,
    _: UserInDB = Depends(get_current_gestor),
    db: Session = Depends(get_db),
) -> None:
    source = (
        db.query(DBInformationSource)
        .filter(DBInformationSource.id == source_id)
        .first()
    )
    if source is None:
        raise HTTPException(
            status_code=404, detail="Fuente de información no encontrada"
        )

    (
        db.query(DBRSSChannel)
        .filter(DBRSSChannel.information_source_id == source_id)
        .delete(synchronize_session=False)
    )
    db.delete(source)
    db.commit()
