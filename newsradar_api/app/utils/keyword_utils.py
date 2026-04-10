import requests
from typing import List


# Puedes reemplazar esta función por una integración más avanzada o una base de datos de sinónimos
# Aquí se usa la API de Datamuse como ejemplo (gratuita y sin autenticación)
def get_related_words(keyword: str, max_results: int = 10) -> List[str]:
    """
    Devuelve una lista de palabras relacionadas o sinónimos para la palabra clave dada.
    """
    url = f"https://api.datamuse.com/words?ml={keyword}&max={max_results}"
    response = requests.get(url)
    if response.status_code == 200:
        words = [item["word"] for item in response.json()]
        # Filtra la palabra original y limita entre 3 y 10 resultados
        filtered = [w for w in words if w.lower() != keyword.lower()]
        return filtered[:10] if len(filtered) >= 3 else filtered
    return []
