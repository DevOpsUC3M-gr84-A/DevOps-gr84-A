"""
Este módulo se encarga de inicializar la base de datos y
crear un usuario administrador inicial si no existe ninguno.
"""

import json
import os
import logging
from json import JSONDecodeError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.database.database import SessionLocal, engine, Base
from app.database.generate_rss_seed import generate_seed_data
from app.models.rss import CategoriaIPTC, InformationSource, RSSChannel
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

# Configuración de passlib para generar hashes con argon2
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """Genera un hash seguro para la contraseña."""
    return pwd_context.hash(password)


def _map_seed_category_to_iptc(category_text: str | None) -> CategoriaIPTC:
    """Mapea categorías de seed (texto) a enum de categorías IPTC."""
    category_map = {
        "politics": CategoriaIPTC.POLITICA,
        "economy_business_and_finance": CategoriaIPTC.ECONOMIA,
        "sports": CategoriaIPTC.DEPORTES,
        "science_and_technology": CategoriaIPTC.TECNOLOGIA,
        "arts_and_entertainment": CategoriaIPTC.CULTURA,
        "health": CategoriaIPTC.SALUD,
        "environmental_issue": CategoriaIPTC.MEDIO_AMBIENTE,
        "science": CategoriaIPTC.CIENCIA,
    }
    if not category_text:
        return CategoriaIPTC.OTROS

    return category_map.get(category_text.lower(), CategoriaIPTC.OTROS)


def _process_and_insert_sources(
    db: Session, raw_sources: list[dict]
) -> dict[int, str]:
    """Procesa e inserta las fuentes de información, devolviendo id->name."""
    source_names_by_id: dict[int, str] = {}
    source_models: list[InformationSource] = []

    for source in raw_sources:
        source_id = source.get("id")
        source_name = source.get("name")
        source_url = source.get("url")
        source_domain = source.get("domain")

        if not source_name:
            continue

        final_source_url = source_url or (
            f"https://{source_domain}"
            if source_domain
            else f"https://{source_name.lower().replace(' ', '')}.com"
        )

        source_kwargs = {"name": source_name, "url": final_source_url}
        if source_id is not None:
            source_kwargs["id"] = source_id
            source_names_by_id[source_id] = source_name

        source_models.append(InformationSource(**source_kwargs))

    if source_models:
        db.add_all(source_models)
        db.flush()

    return source_names_by_id


def _process_and_insert_channels(
    db: Session, raw_channels: list[dict], source_name_by_id: dict[int, str]
) -> None:
    """Procesa e inserta los canales RSS manteniendo el mapeo IPTC."""
    rss_channel_models: list[RSSChannel] = []

    for channel in raw_channels:
        channel_id = channel.get("id")
        source_id = channel.get("information_source_id")
        channel_url = channel.get("url")

        if not source_id or not channel_url:
            continue

        media_name = channel.get("media_name") or source_name_by_id.get(source_id, "Unknown")
        category_text = channel.get("category_iptc")
        category_id = channel.get("category_id")

        channel_kwargs = {
            "information_source_id": source_id,
            "media_name": media_name,
            "url": channel_url,
            "category_id": category_id,
            "iptc_category": _map_seed_category_to_iptc(category_text),
            "is_active": True,
        }
        if channel_id is not None:
            channel_kwargs["id"] = channel_id

        rss_channel_models.append(RSSChannel(**channel_kwargs))

    if rss_channel_models:
        db.add_all(rss_channel_models)


def load_rss_seed_if_empty(db: Session) -> None:
    """Carga datos seed RSS si la base de datos aún no contiene fuentes/canales."""
    has_sources = db.query(InformationSource.id).first() is not None
    has_channels = db.query(RSSChannel.id).first() is not None
    if has_sources or has_channels:
        logger.info("Seed RSS omitido: la base de datos ya contiene datos.")
        return

    seed_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rss_seed.json")

    try:
        with open(seed_path, "r", encoding="utf-8") as seed_file:
            seed_data = json.load(seed_file)
    except FileNotFoundError:
        logger.warning("No se encontró rss_seed.json. Se generará automáticamente.")
        try:
            generate_seed_data()
            with open(seed_path, "r", encoding="utf-8") as seed_file:
                seed_data = json.load(seed_file)
        except (FileNotFoundError, JSONDecodeError) as exc:
            db.rollback()
            logger.exception("Error al generar/cargar rss_seed.json: %s", exc)
            return
    except JSONDecodeError as exc:
        db.rollback()
        logger.exception("rss_seed.json está corrupto o malformado: %s", exc)
        return

    information_sources_payload = seed_data.get("information_sources", [])
    rss_channels_payload = seed_data.get("rss_channels", [])

    try:
        source_names_by_id = _process_and_insert_sources(db, information_sources_payload)
        _process_and_insert_channels(db, rss_channels_payload, source_names_by_id)

        db.commit()
        inserted_sources_count = len(
            [source for source in information_sources_payload if source.get("name")]
        )
        inserted_channels_count = len(
            [
                channel
                for channel in rss_channels_payload
                if channel.get("information_source_id") and channel.get("url")
            ]
        )
        logger.info(
            "Seed RSS cargado: %s fuentes y %s canales.",
            inserted_sources_count,
            inserted_channels_count,
        )
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Error al insertar seed RSS en la base de datos: %s", exc)


def create_initial_admin(db: Session) -> None:
    """Crea un usuario Gestor inicial verificado si no existe ninguno en la plataforma."""

    # Comprobar si ya existe algún usuario con el rol de GESTOR
    admin = db.query(User).filter(User.role == UserRole.GESTOR).first()

    # Si no existe, crearlo
    if not admin:
        logger.info("No se encontró ningún administrador. Creando Gestor inicial...")

        admin_email = "admin@newsradar.com"
        admin_password = os.getenv("NEWSRADAR_ADMIN_PASSWORD")

        if not admin_email or not admin_password:
            raise RuntimeError("Faltan credenciales de entorno")

        new_admin = User(
            email=admin_email,
            name="Admin",
            surname="Inicial",
            organization="NewsRadar Admin",
            hashed_password=get_password_hash(admin_password),
            role=UserRole.GESTOR,
            is_verified=True,
        )

        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)

        logger.info("Gestor inicial creado exitosamente con el email: %s", admin_email)
    else:
        logger.info(
            "El Gestor inicial %s ya existe. No se ha realizado ninguna acción.",
            admin.email,
        )


if __name__ == "__main__":  # pragma: no cover
    logging.basicConfig(level=logging.INFO)
    logger.info("Iniciando conexión con la base de datos...")
    # Asegurarnos de que las tablas existen (equivalente a una migración inicial sencilla)
    Base.metadata.create_all(bind=engine)

    database = SessionLocal()
    try:
        create_initial_admin(database)
    finally:
        database.close()
