"""
Search and question-answering routes.

POST /api/search    — hybrid search + grounded answer generation
GET  /api/search    — simple GET convenience endpoint for quick queries
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger

from app.core.config import settings
from app.core.dependencies import get_answer_service
from app.models.document import SearchRequest, SearchResponse
from app.services.llm import AnswerService

router = APIRouter(prefix="/api/search", tags=["search"])


# ── POST (full request body) ──────────────────────────────────────────────────

@router.post(
    "",
    response_model=SearchResponse,
    summary="Ask a question over uploaded documents",
)
async def search_post(
    request: SearchRequest,
    answer_service: AnswerService = Depends(get_answer_service),
) -> SearchResponse:
    """
    Full hybrid search + grounded answer.

    - `query`                : natural-language question (required).
    - `top_k`                : number of passages to retrieve (1–20, default 5).
    - `hybrid_alpha`         : 1.0 = semantic only, 0.0 = BM25 only (default 0.5).
    - `enable_reranker`      : cross-encoder reranking (slower but more accurate).
    - `conversation_history` : list of prior `{role, parts}` dicts for follow-ups.
    - `doc_ids`              : restrict search to specific document IDs.
    """
    if not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query cannot be empty.",
        )

    logger.info(
        f"Search request: query='{request.query[:80]}' "
        f"top_k={request.top_k} alpha={request.hybrid_alpha} "
        f"reranker={request.enable_reranker}"
    )

    try:
        response = answer_service.search_and_answer(
            query=request.query,
            top_k=request.top_k,
            alpha=request.hybrid_alpha,
            enable_reranker=request.enable_reranker,
            conversation_history=request.conversation_history,
            doc_ids=request.doc_ids,
        )
    except Exception as exc:
        logger.error(f"Search failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search error: {exc}",
        )

    logger.info(
        f"Search done in {response.latency_ms:.0f} ms — "
        f"{len(response.citations)} citations"
    )
    return response


# ── GET (convenience endpoint for quick manual testing) ───────────────────────

@router.get(
    "",
    response_model=SearchResponse,
    summary="Quick GET-based search (for testing)",
)
async def search_get(
    q: str = Query(..., min_length=1, max_length=2000, description="Your question"),
    top_k: int = Query(default=5, ge=1, le=20),
    alpha: float = Query(default=0.5, ge=0.0, le=1.0),
    answer_service: AnswerService = Depends(get_answer_service),
) -> SearchResponse:
    try:
        return answer_service.search_and_answer(
            query=q,
            top_k=top_k,
            alpha=alpha,
        )
    except Exception as exc:
        logger.error(f"GET search failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
