# ADR-014: Clasificación de Artículos por Categoría IPTC (RF08)

**Status**: ✅ **IMPLEMENTED**  
**Date**: 2025-01-10  
**Author**: DevOps Team  

## Context

**Requirement**: RF08 - Clasificación de Noticias  
Clasificar automáticamente los artículos indexados en Elasticsearch según su categoría IPTC (protocolo de las noticias) usando:
1. Categoría de la alerta (con prioridad)
2. Categoría del canal RSS (fallback si la alerta no tiene categoría)

## Decision

Implementar un workflow de clasificación (`classification_workflow.py`) que:
1. Recupera artículos de Elasticsearch después de ser indexados
2. Consulta la base de datos para obtener:
   - Categorías IPTC del AlertRule asociado
   - Categoría IPTC del RSSChannel como fallback
3. Extrae el primer nivel de categoría IPTC (formato: NNNNNNNN)
4. Actualiza el documento en Elasticsearch con campos:
   - `iptc_category`: Código IPTC clasificado
   - `iptc_category_source`: Fuente ("alert" o "channel")

## Justification

### Arquitectura de Clasificación
- **En la aplicación**: Clasificación sincrónica al indexar artículos (no en un pipeline externo)
- **Integración**: Llamada desde `alert_monitor_agent.py` después de indexar cada artículo
- **Escalabilidad futura**: RF04 puede reemplazar esta lógica por un pipeline NLP/ML

### Formato IPTC de Primer Nivel
Los códigos IPTC tienen 8 dígitos: `DDDDDDDD`
- Primeros 2 dígitos: Categoría principal
- Dígitos 3-4: Subcategoría
- Dígitos 5-8: Niveles más específicos

**Primer nivel** = Primeros 4 dígitos + `"0000"`

**Ejemplo**: 
- Input: `04010001` (Economía > Finanzas > Bolsa > Índices específicos)
- Output: `04010000` (Economía > Finanzas de primer nivel)

### Categorías Soportadas
```python
class CategoriaIPTC(str, enum.Enum):
    POLITICA = "11000000"           # 11
    ECONOMIA = "04000000"           # 04
    DEPORTES = "15000000"           # 15
    TECNOLOGIA = "04010000"         # 04.01 (subcategoría)
    CULTURA = "01000000"            # 01
    SALUD = "07000000"              # 07
    MEDIO_AMBIENTE = "06000000"     # 06
    CIENCIA = "13000000"            # 13
    OTROS = "00000000"              # 00
```

## Implementation

### Archivo: `app/services/workflows/classification_workflow.py`

```python
def _get_first_level_iptc_category(iptc_code: str | None) -> str | None:
    """Convierte un código IPTC a su primer nivel (formato: NNNNNNNN)"""
    if not iptc_code or len(iptc_code) < 4:
        return None
    return iptc_code[:4] + "0000"

def classify_article(article_id: str | int) -> None:
    """RF08: Clasifica artículo por categoría IPTC con precedencia:
    1. Categoría de la alerta
    2. Categoría del canal RSS (fallback)
    """
    # 1. Recuperar documento de Elasticsearch
    # 2. Consultar AlertRule y RSSChannel de base de datos
    # 3. Extraer categoría según precedencia
    # 4. Actualizar documento en Elasticsearch
    # 5. Registrar en logs
```

### Integración con Alert Monitor Agent

**Archivo**: `app/services/agents/alert_monitor_agent.py` (línea 272)
```python
# Después de indexar artículo en Elasticsearch:
classify_article(article_id)
```

## Testing

### Suite de Tests: `tests/unit/test_rf08_classification.py`

**Casos Cubiertos**:
1. ✅ Extracción correcta de primer nivel IPTC
2. ✅ Manejo de códigos cortos (< 4 caracteres)
3. ✅ Manejo de None/input nulo
4. ✅ Clasificación por categoría de alerta (precedencia 1)
5. ✅ Clasificación por categoría de canal (fallback)
6. ✅ Artículo no encontrado en Elasticsearch
7. ✅ Alerta no encontrada en base de datos
8. ✅ Preservación de campos originales durante clasificación

**Resultado**: 8/8 tests passing ✅

## Deployment

### Dependencias Nuevas
- `Elasticsearch` 8.x+ (ya en requirements.txt)
- `SQLAlchemy` 2.0+ (ya instalado)

### Variables de Entorno
No requiere nuevas variables de entorno (usa `ELASTICSEARCH_URL` existente)

### Base de Datos
No requiere migraciones - usa tablas existentes (AlertRule, RSSChannel)

### Elasticsearch
Nuevos campos en documentos de artículos:
- `iptc_category` (string): Código IPTC clasificado
- `iptc_category_source` (string): "alert" o "channel"

## Considerations

### Rendimiento
- Clasificación **sincrónica** al indexar (no introduce latencia significativa)
- Una consulta a BD por artículo (alertas y canales están en caché típicamente)
- Fallback a logs si hay errores (no bloquea indexación)

### Escalabilidad Futura (RF04)
- La lógica actual es un stub que puede reemplazarse por:
  - Clasificación automática NLP/ML
  - Pipeline de procesamiento asincrónico
  - Integración con servicios de IA

### Limitaciones Actuales
- Solo soporta primer nivel de categorización IPTC
- No maneja artículos sin alerta ni canal (se omiten)
- Clasificación binaria (una categoría por artículo)

## References

- **RFC**: RF08 - Clasificación de Noticias
- **RFC**: RF17 - Permisos del Lector (Dependencia: categorías en alertas)
- **IPTC NewsML-G2 Standard**: https://iptc.org/standards/
- **Modelo AlertRule**: [app/models/alert_monitoring.py](../../newsradar_api/app/models/alert_monitoring.py)
- **Modelo RSSChannel**: [app/models/rss.py](../../newsradar_api/app/models/rss.py)

## Related ADRs

- [ADR-001: Arquitectura 5 Capas](ADR-001-arquitectura-5-capas.md)
- [ADR-008: Seed de Datos RSS](ADR-008-seed-datos-rss.md)
- [ADR-013: RBAC - Lector Role](ADR-013-rbac-lector.md)
