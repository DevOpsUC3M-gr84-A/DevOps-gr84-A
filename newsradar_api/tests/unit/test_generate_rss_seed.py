import json
from unittest.mock import mock_open, patch

import pytest

from app.database import generate_rss_seed


@pytest.mark.unit
def test_generate_seed_data_writes_expected_json_payload():
    mocked_file = mock_open()

    with patch("builtins.open", mocked_file), patch.object(json, "dump") as dump_mock:
        generate_rss_seed.generate_seed_data()

    mocked_file.assert_called_once()
    dump_mock.assert_called_once()

    seed_data = dump_mock.call_args.args[0]
    assert "information_sources" in seed_data
    assert "rss_channels" in seed_data
    assert len(seed_data["information_sources"]) == 10
    assert len(seed_data["rss_channels"]) == 170

    file_handle = mocked_file()
    dump_mock.assert_called_once_with(
        seed_data,
        file_handle,
        indent=4,
        ensure_ascii=False,
    )