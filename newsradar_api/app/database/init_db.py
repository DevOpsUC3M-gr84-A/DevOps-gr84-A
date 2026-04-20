"""Utilidades de inicializacion de base de datos y carga de seeds."""

import json
import os
import logging
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from passlib.context import CryptContext
from app.database.database import SessionLocal, engine, Base
from app.models.user import User, UserRole
from app.models.rss import RSSChannel, InformationSource, CategoriaIPTC
from app.database.generate_rss_seed import generate_seed_data

logger = logging.getLogger(__name__)


IPTC_NAME_TO_ENUM: dict[str, CategoriaIPTC] = {
    "politics": CategoriaIPTC.POLITICA,
    "economy_business_and_finance": CategoriaIPTC.ECONOMIA,
    "sports": CategoriaIPTC.DEPORTES,
    "science_and_technology": CategoriaIPTC.TECNOLOGIA,
    "arts_and_entertainment": CategoriaIPTC.CULTURA,
    "health": CategoriaIPTC.SALUD,
    "environmental_issue": CategoriaIPTC.MEDIO_AMBIENTE,
}


def _seed_json_path() -> str:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(current_dir, "rss_seed.json")


def _load_seed_payload(seed_path: str) -> dict:
    if not os.path.exists(seed_path):
        logger.info("No se encontro %s. Generando seed RSS...", seed_path)
        try:
            generate_seed_data()
        except Exception:
            logger.exception("Fallo al generar el archivo seed RSS.")
            return {}

    try:
        with open(seed_path, "r", encoding="utf-8") as seed_file:
            payload = json.load(seed_file)
    except FileNotFoundError:
        logger.error("No existe el archivo de seed RSS: %s", seed_path)
        return {}
    except json.JSONDecodeError as exc:
        logger.error("JSON de seed RSS corrupto en %s: %s", seed_path, exc)
        return {}
    except OSError:
        logger.exception("Error de E/S al leer %s", seed_path)
        return {}

    if not isinstance(payload, dict):
        logger.error("Formato de seed invalido: se esperaba un objeto JSON en %s", seed_path)
        return {}

    return payload


def load_rss_seed_if_empty(db: Session) -> None:
    """Carga canales RSS e information sources desde JSON solo si la tabla RSS esta vacia."""
    channels_count = db.query(RSSChannel).count()
    if channels_count > 0:
        logger.info(
            "Seed RSS omitido: la tabla rss_channels ya contiene %s registros.",
            channels_count,
        )
        return

    payload = _load_seed_payload(_seed_json_path())
    if not payload:
        logger.warning("Seed RSS omitido: payload vacio o invalido.")
        return

    raw_sources = payload.get("information_sources", [])
    raw_channels = payload.get("rss_channels", [])

    existing_source_ids = {
        row.id for row in db.query(InformationSource.id).all()
    }
    source_name_by_id: dict[int, str] = {}

    sources_to_insert: list[InformationSource] = []

    try:
        for source in raw_sources:
            source_id = source.get("id")
            source_name = source.get("name")
            source_domain = source.get("domain")
            if not source_id or not source_name or not source_domain:
                continue

            source_name_by_id[source_id] = source_name
            if source_id in existing_source_ids:
                continue

            sources_to_insert.append(
                InformationSource(
                    id=source_id,
                    name=source_name,
                    url=f"https://{source_domain}",
                )
            )

        if sources_to_insert:
            db.add_all(sources_to_insert)
            db.flush()

        channels_to_insert: list[RSSChannel] = []
        skipped_channels = 0
        for channel in raw_channels:
            channel_id = channel.get("id")
            information_source_id = channel.get("information_source_id")
            iptc_name = channel.get("category_iptc")
            channel_url = channel.get("url")

            if not channel_id or not information_source_id or not iptc_name or not channel_url:
                skipped_channels += 1
                continue

            iptc_enum = IPTC_NAME_TO_ENUM.get(str(iptc_name), CategoriaIPTC.OTROS)

            channels_to_insert.append(
                RSSChannel(
                    id=channel_id,
                    information_source_id=information_source_id,
                    media_name=source_name_by_id.get(information_source_id, "Medio desconocido"),
                    url=channel_url,
                    category_id=None,
                    iptc_category=iptc_enum,
                    is_active=True,
                )
            )

        if not channels_to_insert:
            logger.warning("No se encontraron canales RSS validos para cargar desde el seed.")
            db.rollback()
            return

        db.add_all(channels_to_insert)
        db.commit()
        logger.info(
            "Cargados %s canales RSS desde el seed (omitidos: %s).",
            len(channels_to_insert),
            skipped_channels,
        )
    except (SQLAlchemyError, ValueError, TypeError):
        db.rollback()
        logger.exception("Error cargando seed RSS; transaccion revertida.")
        raise

# Configuración de passlib para generar hashes con argon2
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """Genera un hash seguro para la contraseña."""
    return pwd_context.hash(password)


def create_initial_admin(db: Session) -> None:
    """Crea un usuario Gestor inicial verificado si no existe ninguno en la plataforma."""

    # Comprobar si ya existe algún usuario con el rol de GESTOR
    admin = db.query(User).filter(User.role == UserRole.GESTOR).first()

    # Si no existe, crearlo
    if not admin:
        logger.info("No se encontró ningún administrador. Creando Gestor inicial...")

        admin_email = os.getenv("FIRST_SUPERUSER_EMAIL")
        admin_password = os.getenv("FIRST_SUPERUSER_PASSWORD")

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
