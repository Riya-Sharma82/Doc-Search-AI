"""Health-check and system-info routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import settings
from app.core.dependencies import get_registry, get_vector_store
from app.models.document import HealthResponse
from app.services.document_registry import DocumentRegistry
from app.services.vector_store import FAISSVectorStore

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="Health check")
async def health(
    registry: DocumentRegistry = Depends(get_registry),
    vs: FAISSVectorStore = Depends(get_vector_store),
) -> HealthResponse:
    return HealthResponse(
        status="ok",
        documents_indexed=len(registry.list_all()),
        vector_store_type=settings.vector_store_type,
        embedding_model=settings.embedding_model,
    )


@router.get("/", summary="Root ping")
async def root():
    return {"message": "DocSearch AI API is running", "docs": "/docs"}
