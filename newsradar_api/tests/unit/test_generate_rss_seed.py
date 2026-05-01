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
    assert len(seed_data["information_sources"]) == len(generate_rss_seed.MEDIOS)
    assert len(seed_data["rss_channels"]) == (
        len(generate_rss_seed.MEDIOS) * len(generate_rss_seed.IPTC_CATEGORIES)
    )

    file_handle = mocked_file()
    dump_mock.assert_called_once_with(
        seed_data,
        file_handle,
        indent=4,
        ensure_ascii=False,
    )


@pytest.mark.unit
def test_generate_seed_data_satisfies_rf14_invariants():
    """RF14: 10 medios x 17 categorías = 170 canales con URLs únicas."""
    mocked_file = mock_open()

    with patch("builtins.open", mocked_file), patch.object(json, "dump") as dump_mock:
        generate_rss_seed.generate_seed_data()

    seed_data = dump_mock.call_args.args[0]
    sources = seed_data["information_sources"]
    channels = seed_data["rss_channels"]

    assert len(sources) == 10
    assert len(channels) == 170

    # URLs únicas (la tabla rss_channels.url tiene unique=True).
    urls = [c["url"] for c in channels]
    assert len(set(urls)) == len(urls)

    # Cada medio tiene exactamente 17 canales (uno por categoría IPTC nivel 1).
    for medio in sources:
        per_medio = [c for c in channels if c["information_source_id"] == medio["id"]]
        assert len(per_medio) == 17

    # Cada categoría aparece 10 veces (una por medio) y trae category_id válido.
    for cat in generate_rss_seed.IPTC_CATEGORIES:
        per_cat = [c for c in channels if c["category_iptc"] == cat]
        assert len(per_cat) == 10
        expected_id = generate_rss_seed._category_id_for(cat)
        assert all(c["category_id"] == expected_id for c in per_cat)


@pytest.mark.unit
def test_build_channel_url_uses_override_when_available():
    url = generate_rss_seed._build_channel_url(1, "sports")
    assert url == generate_rss_seed.CATEGORY_FEED_OVERRIDES[1]["sports"]


@pytest.mark.unit
def test_build_channel_url_falls_back_to_homepage_with_unique_marker():
    # "labor" no tiene override en El País → fallback a portada con ?iptc=...
    url = generate_rss_seed._build_channel_url(1, "labor")
    homepage = generate_rss_seed.HOMEPAGE_FEED_BY_MEDIO[1]
    assert url.startswith(homepage)
    assert "iptc=labor" in url


@pytest.mark.unit
def test_build_channel_url_uses_ampersand_when_homepage_already_has_query(monkeypatch):
    # Si la portada ya trae query string, el marcador iptc se concatena con "&".
    fake_homepage = "https://example.test/rss?lang=es"
    monkeypatch.setitem(
        generate_rss_seed.HOMEPAGE_FEED_BY_MEDIO, 1, fake_homepage,
    )
    monkeypatch.setitem(generate_rss_seed.CATEGORY_FEED_OVERRIDES, 1, {})

    url = generate_rss_seed._build_channel_url(1, "labor")
    assert url == f"{fake_homepage}&iptc=labor"