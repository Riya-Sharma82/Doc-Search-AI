"""
DocSearch AI — FastAPI application entry point.

Start with:
    uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

from app.api.routes_documents import router as documents_router
from app.api.routes_health import router as health_router
from app.api.routes_search import router as search_router
from app.core.config import settings
from app.core.dependencies import (
    get_bm25_store,
    get_embedder,
    get_ingestion_service,
    get_registry,
    get_retriever,
    get_vector_store,
)
from app.core.logging import setup_logging


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up all singletons at startup so first requests are fast."""
    setup_logging()

    # Ensure storage directories exist
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    settings.vectorstore_path.mkdir(parents=True, exist_ok=True)
    Path("logs").mkdir(exist_ok=True)

    logger.info("DocSearch AI starting up …")
    logger.info(f"  Embedding model  : {settings.embedding_model}")
    logger.info(f"  Vector store     : {settings.vector_store_type}")
    logger.info(f"  Chunk size       : {settings.chunk_size} / overlap {settings.chunk_overlap}")
    logger.info(f"  Reranker enabled : {settings.enable_reranker}")

    # Pre-load embedding model (can take a few seconds on first run).
    # Skip in test mode so unit tests don't require sentence_transformers.
    import os
    if not os.getenv("DOCSEARCH_TESTING"):
        embedder = get_embedder()
        _ = embedder.dimension   # triggers model download/load

    # Warm up stores (loads persisted data from disk)
    get_registry()
    if not os.getenv("DOCSEARCH_TESTING"):
        get_vector_store()
        get_bm25_store()
        get_retriever()
        get_ingestion_service()

    docs_count = len(get_registry().list_all())
    logger.info(f"  Documents indexed: {docs_count}")
    logger.info("DocSearch AI ready ✓")

    yield

    logger.info("DocSearch AI shutting down …")


# ── App factory ───────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(
        title="DocSearch AI",
        description=(
            "Document-grounded semantic search and question answering. "
            "Upload PDFs, DOCX, or TXT files and ask natural-language questions."
        ),
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Global exception handler ──────────────────────────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception on {request.url}: {exc}")
        return JSONResponse(
            status_code=500,
            content={"detail": "An unexpected server error occurred."},
        )

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(health_router)
    app.include_router(documents_router)
    app.include_router(search_router)

    return app


app = create_app()
