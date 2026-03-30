import feedparser
from typing import List, Dict

def fetch_and_filter_rss(rss_url: str, keywords: List[str]) -> List[Dict]:
    """Descarga y filtra noticias RSS."""
    feed = feedparser.parse(rss_url)
    if feed.bozo:
        return []

    matched_news = []
    keywords_lower = [k.lower() for k in keywords]

    for entry in feed.entries:
        full_text = f"{entry.get('title', '')} {entry.get('summary', '')}".lower()
        if any(keyword in full_text for keyword in keywords_lower):
            matched_news.append({
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "published": entry.get("published", "Fecha desconocida"),
                "summary": entry.get("summary", "")
            })
    return matched_news