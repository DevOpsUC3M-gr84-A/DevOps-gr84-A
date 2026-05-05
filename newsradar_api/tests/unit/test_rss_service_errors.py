from unittest.mock import MagicMock

import pytest
from sqlalchemy.exc import IntegrityError

from app.services import rss_service
from app.schemas.rss import RSSChannelCreate
from app.models.rss import CategoriaIPTC


@pytest.mark.unit
def test_create_rss_channel_integrity_raises_and_rollsback():
    db = MagicMock()
    rss_in = RSSChannelCreate(
        media_name="Test",
        url="https://test.example/rss.xml",
        iptc_category=CategoriaIPTC.TECNOLOGIA,
        category_id=1,
    )

    db.add.return_value = None
    # Simula IntegrityError en commit
    db.commit.side_effect = IntegrityError("stmt", "params", Exception("orig"))

    with pytest.raises(IntegrityError):
        rss_service.create_rss_channel(db, rss_in)

    db.rollback.assert_called_once()
