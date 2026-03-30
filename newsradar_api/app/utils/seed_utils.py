from app.schemas.roles import Role
from app.schemas.user import UserInDB
from app.stores.memory import roles_store, users_store
from app.utils.rss_utils import next_id


def create_seed_data() -> None:
    if roles_store:
        return

    admin_role_id = next_id("roles")
    roles_store[admin_role_id] = Role(id=admin_role_id, name="admin")

    user_role_id = next_id("roles")
    roles_store[user_role_id] = Role(id=user_role_id, name="user")

    admin_user_id = next_id("users")
    users_store[admin_user_id] = UserInDB(
        id=admin_user_id,
        email="admin@newsradar.com",
        first_name="Admin",
        last_name="NewsRadar",
        organization="NewsRadar",
        role_ids=[admin_role_id],
        password="admin123",
    )
