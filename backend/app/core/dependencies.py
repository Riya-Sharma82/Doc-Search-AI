"""
Application-level dependency container.

All services are singletons created once at startup and injected into
FastAPI route handlers via Depends().

Usage in a route:
    @router.post("/search")
    async def search(req: SearchRequest, svc: AnswerService = Depends(get_answer_service)):
        ...
"""
from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.services.bm25_store import BM25Store
from app.services.document_registry import DocumentRegistry
from app.services.embedder import EmbeddingService, get_embedding_service
from app.services.ingestion import IngestionService
from app.services.llm import AnswerService, GeminiLLMService
from app.services.retriever import CrossEncoderReranker, HybridRetriever
from app.services.vector_store import FAISSVectorStore


# ── Singletons ────────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def get_registry() -> DocumentRegistry:
    return DocumentRegistry(persist_dir=settings.vectorstore_path)


@lru_cache(maxsize=1)
def get_embedder() -> EmbeddingService:
    return get_embedding_service(settings.embedding_model)


@lru_cache(maxsize=1)
def get_vector_store() -> FAISSVectorStore:
    embedder = get_embedder()
    return FAISSVectorStore(
        persist_dir=settings.vectorstore_path,
        dimension=embedder.dimension,
    )


@lru_cache(maxsize=1)
def get_bm25_store() -> BM25Store:
    return BM25Store(persist_dir=settings.vectorstore_path)


@lru_cache(maxsize=1)
def get_reranker() -> CrossEncoderReranker | None:
    if settings.enable_reranker:
        return CrossEncoderReranker(settings.reranker_model)
    return None


@lru_cache(maxsize=1)
def get_retriever() -> HybridRetriever:
    return HybridRetriever(
        vector_store=get_vector_store(),
        bm25_store=get_bm25_store(),
        embedder=get_embedder(),
        reranker=get_reranker(),
    )


@lru_cache(maxsize=1)
def get_llm() -> GeminiLLMService:
    return GeminiLLMService(
        api_key=settings.gemini_api_key,
        model_name=settings.gemini_model,
    )


@lru_cache(maxsize=1)
def get_answer_service() -> AnswerService:
    return AnswerService(
        retriever=get_retriever(),
        llm=get_llm(),
    )


@lru_cache(maxsize=1)
def get_ingestion_service() -> IngestionService:
    return IngestionService(
        vector_store=get_vector_store(),
        bm25_store=get_bm25_store(),
        registry=get_registry(),
        embedder=get_embedder(),
    )
