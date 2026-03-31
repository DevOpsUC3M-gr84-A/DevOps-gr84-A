"""Este módulo define los endpoints relacionados con la gestión de canales RSS."""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.rss import RSSChannelCreate, RSSChannelResponse
from app.services.rss_service import create_rss_channel, get_all_rss_channels
from app.api.dependencies import get_current_gestor, get_current_user

router = APIRouter(prefix="/rss", tags=["Canales RSS"])


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
        )


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
