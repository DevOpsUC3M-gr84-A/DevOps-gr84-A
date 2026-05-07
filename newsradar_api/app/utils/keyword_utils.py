import requests
from typing import List


_GENERIC_SUFFIXES = [
    "informacion",
    "noticia",
    "actualidad",
    "tendencia",
    "analisis",
    "reporte",
    "novedad",
    "tema",
    "contexto",
    "resumen",
]


def _hardcoded_descriptors(keyword: str, max_results: int = 10) -> List[str]:
    """Genera una lista determinista de descriptores basados en la palabra clave.

    Garantiza que siempre haya al menos 3 elementos para cumplir RN-001 cuando
    Datamuse falla o devuelve resultados insuficientes.
    """
    base = (keyword or "").strip().lower()
    seen: List[str] = []
    if base:
        seen.append(base)
        seen.append(f"{base}s")
    for suffix in _GENERIC_SUFFIXES:
        candidate = f"{base} {suffix}".strip() if base else suffix
        if candidate and candidate not in seen:
            seen.append(candidate)
        if len(seen) >= max_results:
            break
    # Si la keyword era vacía/muy corta, completamos con genéricos puros.
    for word in _GENERIC_SUFFIXES:
        if len(seen) >= max_results:
            break
        if word not in seen:
            seen.append(word)
    return seen[:max_results]


def get_related_words(keyword: str, max_results: int = 10) -> List[str]:
    """Devuelve entre 3 y `max_results` palabras relacionadas para la keyword.

    Intenta primero la API de Datamuse y, si falla o devuelve menos de 3
    resultados, recurre a un fallback hardcoded para garantizar RN-001.
    """
    filtered: List[str] = []
    try:
        url = f"https://api.datamuse.com/words?ml={keyword}&max={max_results}"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            words = [item["word"] for item in response.json()]
            filtered = [w for w in words if w.lower() != (keyword or "").lower()]
    except requests.RequestException:
        filtered = []

    if len(filtered) < 3:
        return _hardcoded_descriptors(keyword, max_results)
    return filtered[:max_results]
