import feedparser
from typing import List, Dict

def fetch_and_filter_rss(rss_url: str, keywords: List[str]) -> List[Dict]:
    """
    Descarga un canal RSS y filtra las noticias que contengan ALGUNA de las
    palabras clave en el título o en el resumen.
    """
    print(f"📡 Conectando a: {rss_url}...")
    
    # feedparser descarga y convierte el XML en un diccionario de Python
    feed = feedparser.parse(rss_url)
    
    if feed.bozo:
        print(f"⚠️ Advertencia: Problemas de formato en el XML de {rss_url}")

    matched_news = []
    
    # Convertimos las palabras clave a minúsculas para una búsqueda insensible a mayúsculas
    keywords_lower = [k.lower() for k in keywords]

    # Recorremos cada noticia (entry) dentro del periódico
    for entry in feed.entries:
        title = entry.get("title", "")
        summary = entry.get("summary", "")
        
        # Unimos título y resumen en un solo texto para buscar más fácil
        full_text = f"{title} {summary}".lower()
        
        # Comprobamos si alguna de las palabras clave está en el texto
        if any(keyword in full_text for keyword in keywords_lower):
            matched_news.append({
                "title": title,
                "link": entry.get("link", ""),
                "published": entry.get("published", "Fecha desconocida"),
                "summary": summary
            })
            
    return matched_news
