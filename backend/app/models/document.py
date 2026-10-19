"""Pydantic models for documents, chunks, and search results."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Document ──────────────────────────────────────────────────────────────────

class DocumentMetadata(BaseModel):
    doc_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    file_type: str          # pdf | docx | txt
    file_size_bytes: int
    total_pages: int = 0
    total_chunks: int = 0
    upload_time: datetime = Field(default_factory=_utcnow)
    extra: Dict[str, Any] = Field(default_factory=dict)


class DocumentChunk(BaseModel):
    chunk_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    doc_id: str
    filename: str
    page_number: int        # 1-indexed; 0 if unknown
    chunk_index: int        # position within doc
    text: str
    char_start: int = 0
    char_end: int = 0


# ── Upload responses ──────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    doc_id: str
    filename: str
    total_chunks: int
    total_pages: int
    message: str = "Document processed successfully"


class DocumentListItem(BaseModel):
    doc_id: str
    filename: str
    file_type: str
    file_size_bytes: int
    total_pages: int
    total_chunks: int
    upload_time: datetime


# ── Search / QA ──────────────────────────────────────────────────────────────

class Citation(BaseModel):
    doc_id: str
    filename: str
    page_number: int
    chunk_index: int
    passage: str
    score: float


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)
    hybrid_alpha: float = Field(default=0.5, ge=0.0, le=1.0)
    enable_reranker: bool = False
    conversation_history: List[Dict[str, str]] = Field(default_factory=list)
    doc_ids: Optional[List[str]] = None   # filter to specific docs


class SearchResponse(BaseModel):
    answer: str
    citations: List[Citation]
    retrieved_passages: List[Citation]
    query: str
    latency_ms: float


# ── Deletion ──────────────────────────────────────────────────────────────────

class DeleteResponse(BaseModel):
    doc_id: str
    message: str


# ── Health ────────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "ok"
    documents_indexed: int = 0
    vector_store_type: str = ""
    embedding_model: str = ""
