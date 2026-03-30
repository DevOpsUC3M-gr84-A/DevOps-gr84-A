import json
from unittest.mock import patch
# ¡ESTA ES LA LÍNEA MÁGICA QUE DA COBERTURA!
from app.database.generate_rss_seed import generate_seed_data

def test_generate_seed_data_creates_correct_json(tmp_path):
    """
    Verifica que el generador de semillas crea el archivo JSON 
    con 10 medios y 170 canales con las URLs correctamente formateadas.
    """
    # 1. Engañamos a la función para que guarde el archivo en una carpeta temporal de Pytest
    with patch('app.database.generate_rss_seed.os.path.dirname', return_value=str(tmp_path)):
        generate_seed_data()
    
    # 2. Comprobamos que el archivo realmente se ha creado
    expected_file = tmp_path / "rss_seed.json"
    assert expected_file.exists(), "El archivo rss_seed.json no se ha creado"
    
    # 3. Leemos el archivo generado para validar su contenido
    with open(expected_file, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    # 4. Validamos que cumple con los requisitos (10 medios, 170 canales)
    assert "information_sources" in data
    assert "rss_channels" in data
    assert len(data["information_sources"]) == 10
    assert len(data["rss_channels"]) == 170
    
    # 5. Comprobamos que la lógica del bucle generó bien las URLs (Medio 1 x Categoría 1)
    first_channel = data["rss_channels"][0]
    assert first_channel["information_source_id"] == 1
    assert first_channel["category_iptc"] == "arts_and_entertainment"
    assert first_channel["url"] == "https://elpais.com/rss/arts_and_entertainment.xml"