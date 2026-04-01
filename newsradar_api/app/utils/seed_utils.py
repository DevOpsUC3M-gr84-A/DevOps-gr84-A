from app.config import admin_password, lector_password
from app.schemas.roles import Role
from app.schemas.user import UserInDB
from app.stores.memory import roles_store, users_store
from app.utils.rss_utils import next_id


def create_seed_data() -> None:
    if roles_store:
        return

    admin_role_id = next_id("roles")
    roles_store[admin_role_id] = Role(id=admin_role_id, name="Gestor")

    lector_role_id = next_id("roles")
    roles_store[lector_role_id] = Role(id=lector_role_id, name="Lector")

    admin_user_id = next_id("users")
    users_store[admin_user_id] = UserInDB(
        id=admin_user_id,
        email="admin@newsradar.com",
        first_name="Admin",
        last_name="NewsRadar",
        organization="NewsRadar",
        role_ids=[admin_role_id],
        password=admin_password,
    )

    lector_user_id = next_id("users")
    users_store[lector_user_id] = UserInDB(
        id=lector_user_id,
        email="lector@newsradar.com",
        first_name="Lector",
        last_name="NewsRadar",
        organization="NewsRadar",
        role_ids=[lector_role_id],
        password=lector_password,
    )
