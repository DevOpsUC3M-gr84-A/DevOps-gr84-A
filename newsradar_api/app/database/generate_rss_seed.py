import json
import os

def generate_seed_data():
    """Genera un dataset inicial (Seed) cumpliendo el RF14: 
    10 medios, categorías IPTC completas, >100 canales."""
    
    # 1. Los 10 medios de comunicación exigidos
    medios = [
        {"id": 1, "name": "El País", "domain": "elpais.com"},
        {"id": 2, "name": "El Mundo", "domain": "elmundo.es"},
        {"id": 3, "name": "ABC", "domain": "abc.es"},
        {"id": 4, "name": "La Vanguardia", "domain": "lavanguardia.com"},
        {"id": 5, "name": "El Confidencial", "domain": "elconfidencial.com"},
        {"id": 6, "name": "RTVE", "domain": "rtve.es"},
        {"id": 7, "name": "20 Minutos", "domain": "20minutos.es"},
        {"id": 8, "name": "Público", "domain": "publico.es"},
        {"id": 9, "name": "Eldiario.es", "domain": "eldiario.es"},
        {"id": 10, "name": "Europa Press", "domain": "europapress.es"}
    ]

    # 2. Las 17 categorías de primer nivel (Top-Level) del estándar IPTC Media Topics
    iptc_categories = [
        "arts_and_entertainment", "crime_law_and_justice", "disaster_and_accident",
        "economy_business_and_finance", "education", "environmental_issue",
        "health", "human_interest", "labor", "lifestyle_and_leisure",
        "politics", "religion_and_belief", "science_and_technology",
        "society", "sports", "unrest_conflicts_and_war", "weather"
    ]

    rss_channels = []
    channel_id = 1

    # 3. Generación combinada (10 medios x 17 categorías = 170 canales RSS)
    for medio in medios:
        for cat in iptc_categories:
            rss_channels.append({
                "id": channel_id,
                "information_source_id": medio["id"],
                "category_iptc": cat,
                "url": f"https://{medio['domain']}/rss/{cat}.xml"
            })
            channel_id += 1

    seed_data = {
        "information_sources": medios,
        "rss_channels": rss_channels
    }

    # 4. Guardar en un archivo JSON en la misma carpeta que este script
    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(current_dir, "rss_seed.json")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(seed_data, f, indent=4, ensure_ascii=False)

    print(f"¡Éxito! Generados {len(medios)} medios y {len(rss_channels)} canales RSS en: {output_path}")

if __name__ == "__main__":
    generate_seed_data()