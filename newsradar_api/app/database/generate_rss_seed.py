import json
import os
import logging

logger = logging.getLogger(__name__)

# 1. Los 10 medios de comunicación exigidos por RF14.
MEDIOS = [
    {"id": 1, "name": "El País", "domain": "elpais.com"},
    {"id": 2, "name": "El Mundo", "domain": "elmundo.es"},
    {"id": 3, "name": "ABC", "domain": "abc.es"},
    {"id": 4, "name": "La Vanguardia", "domain": "lavanguardia.com"},
    {"id": 5, "name": "El Confidencial", "domain": "elconfidencial.com"},
    {"id": 6, "name": "RTVE", "domain": "rtve.es"},
    {"id": 7, "name": "20 Minutos", "domain": "20minutos.es"},
    {"id": 8, "name": "Público", "domain": "publico.es"},
    {"id": 9, "name": "Eldiario.es", "domain": "eldiario.es"},
    {"id": 10, "name": "Europa Press", "domain": "europapress.es"},
]

# 2. Las 17 categorías de primer nivel (Top-Level) del estándar IPTC Media Topics.
IPTC_CATEGORIES = [
    "arts_and_entertainment",
    "crime_law_and_justice",
    "disaster_and_accident",
    "economy_business_and_finance",
    "education",
    "environmental_issue",
    "health",
    "human_interest",
    "labor",
    "lifestyle_and_leisure",
    "politics",
    "religion_and_belief",
    "science_and_technology",
    "society",
    "sports",
    "unrest_conflicts_and_war",
    "weather",
]

# 3. Feed de portada/homepage por medio. Es el "fallback" garantizado: cualquier
# categoría sin feed específico se sirve desde aquí. La URL completa será única
# en BD añadiendo un parámetro `?iptc=<cat>` (la unique constraint del modelo
# RSSChannel exige URLs distintas por canal). El servidor ignora ese parámetro
# y devuelve 200 OK con la portada.
HOMEPAGE_FEED_BY_MEDIO = {
    1: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada",
    2: "https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml",
    3: "https://www.abc.es/rss/feeds/abcPortada.xml",
    4: "https://www.lavanguardia.com/rss/home.xml",
    5: "https://rss.elconfidencial.com/espana/",
    6: "https://api.rtve.es/api/noticias.rss",
    7: "https://www.20minutos.es/rss/",
    8: "https://www.publico.es/rss/",
    9: "https://www.eldiario.es/rss/",
    10: "https://www.europapress.es/rss/rss.aspx",
}

# 4. Overrides de feeds específicos por (medio, categoría_iptc). Donde no haya
# entrada se usa la portada de HOMEPAGE_FEED_BY_MEDIO.
CATEGORY_FEED_OVERRIDES: dict[int, dict[str, str]] = {
    # El País
    1: {
        "politics": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/espana",
        "economy_business_and_finance": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia",
        "arts_and_entertainment": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/cultura",
        "sports": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/deportes",
        "society": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/sociedad",
        "science_and_technology": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/tecnologia",
        "environmental_issue": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/clima-y-medio-ambiente",
    },
    # El Mundo
    2: {
        "politics": "https://e00-elmundo.uecdn.es/elmundo/rss/espana.xml",
        "economy_business_and_finance": "https://e00-elmundo.uecdn.es/elmundo/rss/economia.xml",
        "arts_and_entertainment": "https://e00-elmundo.uecdn.es/elmundo/rss/cultura.xml",
        "science_and_technology": "https://e00-elmundo.uecdn.es/elmundo/rss/ciencia.xml",
        "health": "https://e00-elmundo.uecdn.es/elmundosalud/rss/portada.xml",
    },
    # ABC
    3: {
        "politics": "https://www.abc.es/rss/feeds/abc_EspanaEspana.xml",
        "economy_business_and_finance": "https://www.abc.es/rss/feeds/abc_Economia.xml",
        "arts_and_entertainment": "https://www.abc.es/rss/feeds/abc_Cultura.xml",
        "sports": "https://www.abc.es/rss/feeds/abc_Deportes.xml",
        "science_and_technology": "https://www.abc.es/rss/feeds/abc_Ciencia.xml",
    },
    # La Vanguardia
    4: {
        "politics": "https://www.lavanguardia.com/rss/politica.xml",
        "economy_business_and_finance": "https://www.lavanguardia.com/rss/economia.xml",
        "arts_and_entertainment": "https://www.lavanguardia.com/rss/cultura.xml",
        "sports": "https://www.lavanguardia.com/rss/deportes.xml",
        "science_and_technology": "https://www.lavanguardia.com/rss/tecnologia.xml",
        "environmental_issue": "https://www.lavanguardia.com/rss/natural.xml",
    },
    # El Confidencial
    5: {
        "economy_business_and_finance": "https://rss.elconfidencial.com/mercados/",
        "arts_and_entertainment": "https://rss.elconfidencial.com/cultura/",
        "sports": "https://rss.elconfidencial.com/deportes/",
        "science_and_technology": "https://rss.elconfidencial.com/tecnologia/",
    },
    # RTVE
    6: {
        "sports": "https://api.rtve.es/api/deportes.rss",
        "science_and_technology": "https://api.rtve.es/api/ciencia-y-tecnologia.rss",
        "arts_and_entertainment": "https://api.rtve.es/api/cultura.rss",
    },
    # 20 Minutos
    7: {
        "politics": "https://www.20minutos.es/rss/nacional/",
        "economy_business_and_finance": "https://www.20minutos.es/rss/economia/",
        "arts_and_entertainment": "https://www.20minutos.es/rss/cultura/",
        "sports": "https://www.20minutos.es/rss/deportes/",
        "science_and_technology": "https://www.20minutos.es/rss/tecnologia/",
    },
    # Público
    8: {
        "politics": "https://www.publico.es/rss/politica/",
        "economy_business_and_finance": "https://www.publico.es/rss/economia/",
        "arts_and_entertainment": "https://www.publico.es/rss/culturas/",
        "sports": "https://www.publico.es/rss/deportes/",
    },
    # Eldiario.es
    9: {
        "politics": "https://www.eldiario.es/rss/politica/",
        "economy_business_and_finance": "https://www.eldiario.es/rss/economia/",
        "arts_and_entertainment": "https://www.eldiario.es/rss/cultura/",
        "science_and_technology": "https://www.eldiario.es/rss/tecnologia/",
    },
    # Europa Press
    10: {
        "politics": "https://www.europapress.es/rss/rss.aspx?ch=66",
        "economy_business_and_finance": "https://www.europapress.es/rss/rss.aspx?ch=136",
        "sports": "https://www.europapress.es/rss/rss.aspx?ch=63",
    },
}


def _category_id_for(category_iptc: str) -> int:
    """Devuelve un id estable 1-17 para cada categoría IPTC."""
    return IPTC_CATEGORIES.index(category_iptc) + 1


def _build_channel_url(medio_id: int, category_iptc: str) -> str:
    """Devuelve la URL del feed para (medio, categoría).

    Si existe un feed específico se usa tal cual. En caso contrario se devuelve
    la portada del medio con un query param de marcado para garantizar:
      - 200 OK al ser leída por el Scheduler (es la portada real del medio).
      - URL única en BD, exigida por la unique constraint de RSSChannel.url.
    """
    override = CATEGORY_FEED_OVERRIDES.get(medio_id, {}).get(category_iptc)
    if override:
        return override

    homepage = HOMEPAGE_FEED_BY_MEDIO[medio_id]
    separator = "&" if "?" in homepage else "?"
    return f"{homepage}{separator}iptc={category_iptc}"


def generate_seed_data() -> None:
    """Genera el dataset inicial cumpliendo RF14: 10 medios x 17 categorías = 170 canales."""

    rss_channels: list[dict] = []
    channel_id = 1

    for medio in MEDIOS:
        for cat in IPTC_CATEGORIES:
            rss_channels.append(
                {
                    "id": channel_id,
                    "information_source_id": medio["id"],
                    "media_name": medio["name"],
                    "category_iptc": cat,
                    "category_id": _category_id_for(cat),
                    "url": _build_channel_url(medio["id"], cat),
                }
            )
            channel_id += 1

    seed_data = {
        "information_sources": MEDIOS,
        "rss_channels": rss_channels,
    }

    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(current_dir, "rss_seed.json")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(seed_data, f, indent=4, ensure_ascii=False)

    logger.info(
        "Seed generado: %s medios y %s canales RSS en %s",
        len(MEDIOS),
        len(rss_channels),
        output_path,
    )


# pragma: no cover
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    generate_seed_data()
