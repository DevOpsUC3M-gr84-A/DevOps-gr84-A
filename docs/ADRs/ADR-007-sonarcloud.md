# ADR 007: Adopción de SonarCloud para Métricas de Calidad de Código

**Estado:** Aceptado  
**Fecha original:** 2026-03-23  
**Autores:** Equipo DevOps-gr84-A  

## 1. Contexto
El requisito **RNF08** exige proporcionar métricas de calidad del código fuente de forma automática. Necesitamos una herramienta que analice estáticamente el código en busca de bugs, vulnerabilidades, *code smells* y deuda técnica, integrándose perfectamente con nuestro flujo de trabajo de Integración Continua (CI).

## 2. Alternativas consideradas
- **Flake8 / Pylint locales:** Herramientas ligeras, pero carecen de un panel de mando (dashboard) histórico y métricas visuales avanzadas.
- **SonarQube (Self-hosted):** Potente, pero requiere desplegar y mantener un contenedor extra en nuestra propia infraestructura, consumiendo recursos innecesarios.
- **SonarCloud (SaaS):** Versión en la nube gestionada de SonarQube, gratuita para repositorios públicos y con integración nativa en GitHub Actions.

## 3. Decisión
Se ha decidido adoptar **SonarCloud** como la plataforma oficial de análisis de calidad de código. 
La integración se realizará mediante **GitHub Actions**, ejecutando el escáner automáticamente en cada *Push* o *Pull Request* hacia la rama `main`. El análisis se limitará al directorio `newsradar_api/app` para evitar falsos positivos en dependencias o entornos virtuales.

## 4. Consecuencias
- **Positivas:** - Generación automática del *Quality Gate* (Puerta de Calidad) que bloqueará PRs si el código no cumple los estándares.
  - Cero mantenimiento de infraestructura, al delegar el servicio en la nube (SaaS).
  - Visibilidad total y transparente de la salud del código para todo el equipo.
- **Negativas:** - Dependencia de un servicio de terceros y de la disponibilidad de sus servidores.
  - Mayor tiempo de ejecución en el pipeline de CI debido al proceso de envío y análisis de datos en la nube.

## 5. Notas de Implementación (Actualización: 2026-03-30)
Tras la refactorización de la estructura de directorios (moviendo `tests/` dentro de `newsradar_api/`), se detectó una desincronización en el pipeline que provocaba que SonarCloud no encontrara el informe de cobertura (`coverage.xml`), reportando un 0.0%.

Para garantizar la estabilidad del *Quality Gate*, se ha implementado la siguiente arquitectura de ejecución en los flujos de CI (`ci.yml` y `test.yml`):
1. **Alineación de Contexto (cwd):** El pipeline accede al directorio `newsradar_api/` antes de ejecutar Pytest para resolver correctamente los módulos internos (`--cov=app`).
2. **Elevación de Artefactos:** Los reportes generados (`coverage.xml` y `htmlcov/`) se mueven mediante comandos de shell (`mv`) a la raíz del repositorio, garantizando que el escáner de SonarCloud los encuentre en la ruta esperada (`sonar.python.coverage.reportPaths=coverage.xml`).
3. **Gestión de Deuda Técnica (New Code):** Se ha ajustado la versión en `sonar-project.properties` (ej. `1.1`) para utilizar la métrica de *Previous version* de SonarCloud. Esto reinicia la línea base de cobertura, perdonando el código *legacy* sin tests y exigiendo el 80% (RNF07) únicamente a las nuevas aportaciones.