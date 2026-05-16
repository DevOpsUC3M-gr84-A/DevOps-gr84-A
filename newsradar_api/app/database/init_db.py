"""
Este módulo se encarga de inicializar la base de datos y
crear un usuario administrador inicial si no existe ninguno.
"""

import json
import os
import logging
from json import JSONDecodeError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.database.database import SessionLocal, engine, Base
from app.database.generate_rss_seed import generate_seed_data
from app.models.rss import CategoriaIPTC, InformationSource, RSSChannel
from app.models.user import User, UserRole
# Force-import del resto de modelos para que SQLAlchemy registre TODAS las
# tablas en Base.metadata antes de cualquier `create_all`. Sin esto, si un
# import lateral fallaba a mitad, Base.metadata podía quedar incompleto y las
# queries a `usuarios` / `notifications` rompían con UndefinedTable.
from app.models.alert_monitoring import AlertRule  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.schemas.category import Category
from app.stores.memory import categories_store, iptc_deleted_store

# Tablas con PK autoincremental cuyas secuencias deben sincronizarse cuando se
# insertan filas con id explícito (típicamente vía seed). En PostgreSQL la
# secuencia no avanza al hacer INSERT con id explícito, así que el siguiente
# INSERT genera id=1 y colisiona con la PK existente.
_SEQUENCE_SYNC_TABLES: tuple[str, ...] = (
    "usuarios",
    "information_sources",
    "rss_channels",
    "alert_rules",
    "notifications",
)

logger = logging.getLogger(__name__)

# Configuración de passlib para generar hashes con argon2
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """Genera un hash seguro para la contraseña."""
    return pwd_context.hash(password)


def _map_seed_category_to_iptc(category_text: str | None) -> CategoriaIPTC:
    """Mapea categorías de seed (texto) a enum de categorías IPTC."""
    category_map = {
        "arts_and_entertainment": CategoriaIPTC.CULTURA,
        "crime_law_and_justice": CategoriaIPTC.POLICIA_JUSTICIA,
        "disaster_and_accident": CategoriaIPTC.CATASTROFES_ACCIDENTES,
        "economy_business_and_finance": CategoriaIPTC.ECONOMIA,
        "education": CategoriaIPTC.EDUCACION,
        "environmental_issue": CategoriaIPTC.MEDIO_AMBIENTE,
        "health": CategoriaIPTC.SALUD,
        "human_interest": CategoriaIPTC.INTERES_HUMANO,
        "labor": CategoriaIPTC.MANO_DE_OBRA,
        "lifestyle_and_leisure": CategoriaIPTC.ESTILO_DE_VIDA,
        "politics": CategoriaIPTC.POLITICA,
        "religion_and_belief": CategoriaIPTC.RELIGION,
        "science": CategoriaIPTC.CIENCIA,
        "science_and_technology": CategoriaIPTC.CIENCIA,
        "society": CategoriaIPTC.SOCIEDAD,
        "sports": CategoriaIPTC.DEPORTES,
        "unrest_conflicts_and_war": CategoriaIPTC.CONFLICTO_GUERRA_PAZ,
        "weather": CategoriaIPTC.METEOROLOGIA,
    }
    if not category_text:
        return CategoriaIPTC.OTROS

    normalized = category_text.lower().strip()
    if normalized.startswith("medtop:"):
        normalized = normalized.split(":", 1)[1]
    return category_map.get(normalized, CategoriaIPTC.OTROS)


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

        category_id_int = None
        if category_id is not None:
            try:
                category_id_int = int(category_id)
            except (TypeError, ValueError):
                category_id_int = None

        channel_kwargs = {
            "information_source_id": source_id,
            "media_name": media_name,
            "url": channel_url,
            "category_id": category_id_int,
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


# Mapping IPTC oficial: (id_entero, label, enum_categoria_iptc).
_IPTC_TOPLEVEL_SEED: tuple[tuple[int, str, CategoriaIPTC], ...] = (
    (1000000, "Artes, cultura, entretenimiento y medios", CategoriaIPTC.CULTURA),
    (2000000, "Policía y justicia", CategoriaIPTC.POLICIA_JUSTICIA),
    (3000000, "Catástrofes y accidentes", CategoriaIPTC.CATASTROFES_ACCIDENTES),
    (4000000, "Economía, negocios y finanzas", CategoriaIPTC.ECONOMIA),
    (5000000, "Educación", CategoriaIPTC.EDUCACION),
    (6000000, "Medio ambiente", CategoriaIPTC.MEDIO_AMBIENTE),
    (7000000, "Salud", CategoriaIPTC.SALUD),
    (8000000, "Interés humano, animales, insólito", CategoriaIPTC.INTERES_HUMANO),
    (9000000, "Mano de obra", CategoriaIPTC.MANO_DE_OBRA),
    (10000000, "Estilo de vida y tiempo libre", CategoriaIPTC.ESTILO_DE_VIDA),
    (11000000, "Política", CategoriaIPTC.POLITICA),
    (12000000, "Religión y culto", CategoriaIPTC.RELIGION),
    (13000000, "Ciencia y tecnología", CategoriaIPTC.CIENCIA),
    (14000000, "Sociedad", CategoriaIPTC.SOCIEDAD),
    (15000000, "Deporte", CategoriaIPTC.DEPORTES),
    (16000000, "Conflicto, guerra y paz", CategoriaIPTC.CONFLICTO_GUERRA_PAZ),
    (17000000, "Meteorología", CategoriaIPTC.METEOROLOGIA),
)


def _ensure_categories_table(engine_to_use) -> None:
    """Crea/migra la tabla `categories` (PK INTEGER) usando una conexión propia.

    Aislamos este DDL del Session principal: si fallaba a mitad de transacción,
    la sesión quedaba en estado "aborted" y el resto del bootstrap (incluido el
    seed RSS y los queries sobre `usuarios`) caía con UndefinedTable o
    InFailedSqlTransaction.
    """
    is_postgres = engine_to_use.url.get_backend_name().startswith("postgres")

    with engine_to_use.begin() as conn:
        # Detectar si existe con un tipo de PK incompatible (varchar de runs previos
        # con String(8)). Si es el caso, dropear; si es INTEGER, dejar tal cual.
        if is_postgres:
            row = conn.execute(
                text(
                    "SELECT data_type FROM information_schema.columns "
                    "WHERE table_name = 'categories' AND column_name = 'id'"
                )
            ).first()
            if row is not None and "int" not in (row[0] or "").lower():
                conn.execute(text("DROP TABLE IF EXISTS categories CASCADE"))

        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS categories ("
                "id INTEGER PRIMARY KEY, "
                "name VARCHAR(255) NOT NULL, "
                "iptc_code INTEGER, "
                "iptc_label VARCHAR(255), "
                "source VARCHAR(50) NOT NULL DEFAULT 'IPTC'"
                ")"
            )
        )

    with engine_to_use.begin() as conn:
        for code, label, _iptc in _IPTC_TOPLEVEL_SEED:
            exists = conn.execute(
                text("SELECT 1 FROM categories WHERE id = :id"),
                {"id": code},
            ).first()
            if exists:
                continue
            conn.execute(
                text(
                    "INSERT INTO categories (id, name, iptc_code, iptc_label, source) "
                    "VALUES (:id, :name, :code, :label, 'IPTC')"
                ),
                {"id": code, "name": label, "code": code, "label": label},
            )


def seed_iptc_categories_and_channels(db: Session) -> None:
    """Asegura las 17 categorías IPTC con id forzado al código numérico + un canal RSS por cada una."""

    # Defensa en profundidad: si por cualquier razón `create_all` no llegó a
    # ejecutarse, lo aseguramos aquí antes de cualquier query a `usuarios` /
    # `rss_channels` / `information_sources`.
    try:
        Base.metadata.create_all(bind=engine)
    except SQLAlchemyError as exc:
        logger.exception("create_all defensivo en seed falló: %s", exc)

    try:
        _ensure_categories_table(engine)
        categories_store.clear()
        iptc_deleted_store.clear()
        # No pre-populamos categories_store. El fallback IPTC_FIRST_LEVEL en
        # list_categories sirve los 17 ítems para SMOKE-004/005 sin necesitar
        # el store. Los tests GC pueden crear (POST 201) y borrar libremente.

        existing_source = (
            db.query(InformationSource).filter(InformationSource.id == 1).first()
        )
        if not existing_source:
            db.add(
                InformationSource(
                    id=1,
                    name="Seed Source",
                    url="http://localhost/seed/source",
                )
            )
            db.flush()

        # Confirmamos categorías + Seed Source antes de los canales para no perderlos
        # si un INSERT posterior lanza IntegrityError y obliga a rollback.
        db.commit()

        for code, _label, iptc_cat in _IPTC_TOPLEVEL_SEED:
            url = f"http://localhost/seed/{code}"
            already_covered = (
                db.query(RSSChannel.id)
                .filter(RSSChannel.category_id == code)
                .first()
            )
            if already_covered:
                continue
            url_taken = db.query(RSSChannel.id).filter(RSSChannel.url == url).first()
            if url_taken:
                continue
            db.add(
                RSSChannel(
                    information_source_id=1,
                    media_name=f"Seed Source {code}",
                    url=url,
                    category_id=code,
                    iptc_category=iptc_cat,
                    is_active=True,
                )
            )
            db.commit()

        # Reset de la secuencia de rss_channels para que el siguiente INSERT
        # auto-incremental no choque con los IDs explícitos del seed. En SQLite
        # no aplica; la condición protege el entorno de tests.
        if engine.url.get_backend_name().startswith("postgres"):
            try:
                db.execute(
                    text(
                        "SELECT setval("
                        "  'rss_channels_id_seq',"
                        "  COALESCE((SELECT MAX(id) FROM rss_channels), 1),"
                        "  (SELECT MAX(id) IS NOT NULL FROM rss_channels)"
                        ")"
                    )
                )
                db.commit()
            except SQLAlchemyError as exc:
                db.rollback()
                logger.warning("No se pudo resetear rss_channels_id_seq: %s", exc)

        logger.info("Seed IPTC categorías + canales asegurado (17 categorías).")
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Error al sembrar categorías IPTC y canales: %s", exc)


def sync_postgres_sequences(db: Session) -> None:
    """Sincroniza las secuencias `SERIAL` en PostgreSQL con el MAX(id) actual.

    Sin esto, los inserts manuales del seed dejan la secuencia atrás del MAX(id)
    y el siguiente INSERT auto-incremental colisiona con la PK existente,
    devolviendo IntegrityError de `_pkey` que se confunde con duplicados de
    nombre/URL. En SQLite no hace nada (no aplica).
    """

    if not engine.url.get_backend_name().startswith("postgres"):
        return

    for table in _SEQUENCE_SYNC_TABLES:
        try:
            # `is_called=true` arranca desde el siguiente valor; COALESCE evita
            # NULL si la tabla está vacía. Idempotente y seguro de re-ejecutar.
            db.execute(
                text(
                    f"SELECT setval("
                    f"  pg_get_serial_sequence('{table}', 'id'),"
                    f"  COALESCE((SELECT MAX(id) FROM {table}), 1),"
                    f"  (SELECT MAX(id) IS NOT NULL FROM {table})"
                    f")"
                )
            )
        except SQLAlchemyError as exc:
            db.rollback()
            logger.warning(
                "No se pudo sincronizar la secuencia de %s: %s", table, exc
            )
            continue
    db.commit()
    logger.info("Secuencias PostgreSQL sincronizadas: %s", ", ".join(_SEQUENCE_SYNC_TABLES))


def create_initial_admin(db: Session) -> None:
    """Asegura el usuario Admin inicial (upsert por email).

    Si ya existe un usuario con `admin_email`, refresca su hash de contraseña,
    rol y flag de verificado a partir de la configuración de entorno. Esto evita
    `IntegrityError` por email duplicado y permite rotar la contraseña del
    admin con un simple redeploy.
    """

    admin_email = "admin@newsradar.com"
    existing = db.query(User).filter(User.email == admin_email).first()

    if existing is None:
        admin_password = os.getenv("NEWSRADAR_ADMIN_PASSWORD")

        if not admin_password:
            raise RuntimeError("Faltan credenciales de entorno")

        hashed = get_password_hash(admin_password)

        new_admin = User(
            email=admin_email,
            name="Admin",
            surname="Inicial",
            organization="NewsRadar Admin",
            hashed_password=hashed,
            role=UserRole.ADMIN,
            is_verified=True,
        )
        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)
        logger.info("Admin inicial creado con el email: %s", admin_email)
        return

    logger.info("Admin inicial %s ya existía: no se recrea.", admin_email)


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