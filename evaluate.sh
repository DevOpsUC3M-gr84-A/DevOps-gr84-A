#!/usr/bin/env bash
# evaluate.sh — RNF10: despliegue reproducible con un único comando.
# Construye el sistema (con 100 canales semilla), levanta los servicios,
# ejecuta pruebas con cobertura y muestra las URLs de la aplicación.

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${YELLOW}==>${NC} ${BOLD}$1${NC}"; }
success() { echo -e "${GREEN}[OK]${NC} ${BOLD}$1${NC}"; }
fail()    { echo -e "${RED}[ERR]${NC} ${BOLD}$1${NC}"; }

trap 'fail "Fallo durante la evaluación. Revisa los logs con: docker compose logs"' ERR

# 1) Limpieza de contenedores y volúmenes huérfanos
info "Paso 1/5 — Limpiando contenedores y volúmenes previos..."
docker compose down -v --remove-orphans || true

# 2) Construcción de imágenes
info "Paso 2/5 — Construyendo imágenes Docker..."
docker compose build

# 3) Arranque en segundo plano
info "Paso 3/5 — Levantando servicios (api-backend, postgres, elasticsearch)..."
docker compose up -d

# 4) Espera activa a que la API responda
info "Paso 4/5 — Esperando a que la API y la base de datos estén listas..."
ATTEMPTS=0
MAX_ATTEMPTS=40
until curl -fsS http://localhost:8000/docs >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    fail "La API no respondió tras $((MAX_ATTEMPTS * 3))s. Abortando."
    docker compose logs --tail=80 api-backend
    exit 1
  fi
  sleep 3
done
success "API disponible en http://localhost:8000"

# 5) Pruebas y cobertura dentro del contenedor del backend
info "Paso 5/5 — Ejecutando pruebas y generando cobertura HTML dentro del contenedor..."
docker compose exec -T api-backend pytest --cov=app --cov-report=html --cov-report=term

echo ""
echo -e "${GREEN}============================================================${NC}"
success "Despliegue completado correctamente (RNF10)."
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "${BOLD}URLs de la aplicación:${NC}"
echo -e "  ${GREEN}•${NC} Frontend (Vite, requiere 'cd newsradar_ui && npm run dev'): ${BOLD}http://localhost:5173${NC}"
echo -e "  ${GREEN}•${NC} API Backend (FastAPI):                                       ${BOLD}http://localhost:8000${NC}"
echo -e "  ${GREEN}•${NC} Documentación Swagger / OpenAPI:                             ${BOLD}http://localhost:8000/docs${NC}"
echo -e "  ${GREEN}•${NC} ReDoc:                                                       ${BOLD}http://localhost:8000/redoc${NC}"
echo -e "  ${GREEN}•${NC} Elasticsearch:                                               ${BOLD}http://localhost:9200${NC}"
echo ""
echo -e "${BOLD}Cobertura HTML:${NC} newsradar_api/htmlcov/index.html (dentro del contenedor: /app/htmlcov)"
echo -e "${BOLD}Apagar el entorno:${NC} docker compose down -v"
echo ""
