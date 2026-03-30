import feedparser
from typing import List, Dict

def fetch_and_filter_rss(rss_url: str, keywords: List[str]) -> List[Dict]:
    """
    Descarga un canal RSS y filtra las noticias que contengan ALGUNA de las
    palabras clave en el título o en el resumen.
    """
    # feedparser descarga y convierte el XML en un diccionario de Python
    feed = feedparser.parse(rss_url)
    
    if feed.bozo:
        return []

    matched_news = []
    keywords_lower = [k.lower() for k in keywords]

    for entry in feed.entries:
        title = entry.get("title", "")
        summary = entry.get("summary", "")
        full_text = f"{title} {summary}".lower()
        
        if any(keyword in full_text for keyword in keywords_lower):
            matched_news.append({
                "title": title,
                "link": entry.get("link", ""),
                "published": entry.get("published", "Fecha desconocida"),
                "summary": summary
            })
            
    return matched_news