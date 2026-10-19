# ── Backend Dockerfile ────────────────────────────────────────────────────────
# Multi-stage build: keep the final image lean by separating dependency
# installation from the runtime layer.

# ── Stage 1: dependency builder ───────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# System deps needed to compile some Python extensions (faiss-cpu, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
 && pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

LABEL maintainer="DocSearch AI"
LABEL description="DocSearch AI — Document-Grounded Semantic Search Backend"

# Non-root user for security
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY app/ ./app/
COPY run.py .

# Create data directories (volume-mountable)
RUN mkdir -p data/uploads data/vectorstore logs \
 && chown -R appuser:appuser /app

USER appuser

# Expose the API port
EXPOSE 8000

# Healthcheck — polls /api/health every 30 s
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
