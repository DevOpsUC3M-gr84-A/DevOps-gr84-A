# syntax=docker/dockerfile:1.6

# ============================================================
# Stage 1 — builder: instala dependencias en un venv aislado
# ============================================================
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt


# ============================================================
# Stage 2 — runtime: imagen final mínima ejecutándose como appuser
# ============================================================
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:${PATH}"

# Hardening: usuario no privilegiado dedicado a la API
RUN groupadd --system --gid 1001 appgroup \
    && useradd --system --uid 1001 --gid appgroup --home-dir /app --shell /usr/sbin/nologin appuser

WORKDIR /app

# Copiamos el venv ya construido desde la etapa builder
COPY --from=builder /opt/venv /opt/venv

# Copiamos el código fuente con propiedad explícita del usuario no root
COPY --chown=appuser:appgroup ./app ./app

# Directorio dedicado a datos persistentes (SQLite, etc.). Si se monta un
# bind-mount del host sobre /app/data, debe pertenecer al UID 1001 (appuser)
# o tener permisos de escritura para él.
RUN mkdir -p /app/data \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
