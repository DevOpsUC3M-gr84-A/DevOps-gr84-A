from __future__ import annotations


from fastapi import APIRouter
from fastapi.security import HTTPBearer

from app.utils.seed_utils import create_seed_data
from .routes.auth import api_auth_router
from .routes.users import users_router
from .routes.roles import roles_router
from .routes.alerts import api_alerts_router
from .routes.notifications import notifications_router
from .routes.categories import categories_router
from .routes.information_sources import information_sources_router
from .routes.stats import stats_router
from .routes.rss_channels import router as rss_channels_router

api_router = APIRouter()
api_router.include_router(api_auth_router)
api_router.include_router(users_router)
api_router.include_router(roles_router)
api_router.include_router(api_alerts_router)
api_router.include_router(notifications_router)
api_router.include_router(categories_router)
api_router.include_router(information_sources_router)
api_router.include_router(stats_router)
api_router.include_router(rss_channels_router)


@api_router.on_event("startup")
def on_startup() -> None:
    create_seed_data()


API_PREFIX = "/api/v1"
security = HTTPBearer(auto_error=False)
