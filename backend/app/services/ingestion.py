"""
Ingestion service: orchestrates the full document-processing pipeline.

  parse → chunk → embed → store in FAISS + BM25 + registry

This is the single entry-point the API layer calls when a new document
is uploaded.  Deletion is also coordinated here so both stores stay in
sync.
"""
from __future__ import annotations

import uuid
from pathlib import Path
from typing import Optional

from loguru import logger

from app.core.config import settings
from app.models.document import DocumentMetadata, UploadResponse
from app.services.bm25_store import BM25Store
from app.services.chunker import chunk_document
from app.services.document_parser import parse_document
from app.services.document_registry import DocumentRegistry
from app.services.embedder import EmbeddingService
from app.services.vector_store import FAISSVectorStore


class IngestionService:
    def __init__(
        self,
        vector_store: FAISSVectorStore,
        bm25_store: BM25Store,
        registry: DocumentRegistry,
        embedder: EmbeddingService,
    ) -> None:
        self._vs       = vector_store
        self._bm25     = bm25_store
        self._registry = registry
        self._embedder = embedder

    # ── Ingest ────────────────────────────────────────────────────────────────

    def ingest(
        self,
        file_path: Path,
        original_filename: str,
        doc_id: Optional[str] = None,
    ) -> UploadResponse:
        """
        Full pipeline: parse → chunk → embed → index.

        Parameters
        ----------
        file_path           : path to the saved upload on disk.
        original_filename   : user-visible filename (used in citations).
        doc_id              : supply to re-ingest an existing doc_id;
                              otherwise a new UUID is generated.

        Returns
        -------
        UploadResponse with processing stats.
        """
        doc_id = doc_id or str(uuid.uuid4())
        file_type = file_path.suffix.lower().lstrip(".")
        file_size = file_path.stat().st_size

        logger.info(f"Ingesting '{original_filename}' (doc_id={doc_id})")

        # ── 1. Parse ──────────────────────────────────────────────────────────
        pages, total_pages = parse_document(file_path)
        if not pages:
            raise ValueError(f"No extractable text found in '{original_filename}'")

        # ── 2. Chunk ──────────────────────────────────────────────────────────
        chunks = chunk_document(
            pages=pages,
            doc_id=doc_id,
            filename=original_filename,
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
        if not chunks:
            raise ValueError(f"Chunking produced zero chunks for '{original_filename}'")

        # ── 3. Embed ──────────────────────────────────────────────────────────
        texts = [c.text for c in chunks]
        vectors = self._embedder.embed(texts)

        # ── 4. Store ──────────────────────────────────────────────────────────
        self._vs.add_chunks(chunks, vectors)
        self._bm25.add_chunks(chunks)

        # ── 5. Register metadata ──────────────────────────────────────────────
        meta = DocumentMetadata(
            doc_id=doc_id,
            filename=original_filename,
            file_type=file_type,
            file_size_bytes=file_size,
            total_pages=total_pages,
            total_chunks=len(chunks),
        )
        self._registry.add(meta)

        logger.info(
            f"Ingested '{original_filename}': "
            f"{total_pages} pages, {len(chunks)} chunks"
        )
        return UploadResponse(
            doc_id=doc_id,
            filename=original_filename,
            total_chunks=len(chunks),
            total_pages=total_pages,
        )

    # ── Delete ────────────────────────────────────────────────────────────────

    def delete(self, doc_id: str) -> bool:
        """
        Remove a document from all stores and the registry.

        Returns True if the document existed, False otherwise.
        """
        if not self._registry.exists(doc_id):
            return False

        meta = self._registry.get(doc_id)
        filename = meta.filename if meta else doc_id

        self._vs.delete_document(doc_id)
        self._bm25.delete_document(doc_id)
        self._registry.delete(doc_id)

        # Remove uploaded file from disk
        upload_path = settings.upload_path / filename
        if upload_path.exists():
            upload_path.unlink(missing_ok=True)

        logger.info(f"Deleted document '{filename}' (doc_id={doc_id})")
        return True
