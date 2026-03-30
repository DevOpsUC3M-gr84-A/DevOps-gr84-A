"""
Categorías de primer nivel del estándar IPTC Media Topics (idioma: es).
Fuente oficial: https://www.iptc.org/std/NewsCodes/treeview/mediatopic/mediatopic-es.html
Versión del estándar: 2025-10-10
Trazabilidad: RF04, RF08, RF13
"""

IPTC_FIRST_LEVEL: dict[str, str] = {
    "01000000": "Artes, cultura, entretenimiento y medios",
    "02000000": "Policía y justicia",
    "03000000": "Catástrofes y accidentes",
    "04000000": "Economía, negocios y finanzas",
    "05000000": "Educación",
    "06000000": "Medio ambiente",
    "07000000": "Salud",
    "08000000": "Interés humano, animales, insólito",
    "09000000": "Mano de obra",
    "10000000": "Estilo de vida y tiempo libre",
    "11000000": "Política",
    "12000000": "Religión y culto",
    "13000000": "Ciencia y tecnología",
    "14000000": "Sociedad",
    "15000000": "Deporte",
    "16000000": "Conflicto, guerra y paz",
    "17000000": "Meteorología",
}

VALID_IPTC_CODES: frozenset[str] = frozenset(IPTC_FIRST_LEVEL.keys())
VALID_IPTC_NAMES: frozenset[str] = frozenset(IPTC_FIRST_LEVEL.values())
