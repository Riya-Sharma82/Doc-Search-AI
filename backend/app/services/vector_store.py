"""
FAISS-backed vector store with full persistence.

Design
------
- One flat FAISS index (IndexFlatIP) for cosine similarity via inner product
  (vectors must be L2-normalised before insertion).
- A parallel list `_chunks` mirrors the FAISS row order so we can recover
  full DocumentChunk objects from search results.
- The index + metadata are serialised to disk after every write so the store
  survives restarts without re-ingesting documents.
- Thread-safety: a threading.Lock guards all mutating operations.
"""
from __future__ import annotations

import json
import pickle
import threading
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from loguru import logger

from app.models.document import DocumentChunk


_INDEX_FILE = "faiss.index"
_META_FILE  = "faiss_meta.pkl"


class FAISSVectorStore:
    def __init__(self, persist_dir: Path, dimension: int) -> None:
        self._dir       = persist_dir
        self._dim       = dimension
        self._lock      = threading.Lock()
        self._chunks:   List[DocumentChunk] = []
        # doc_id → list of FAISS row indices belonging to that document
        self._doc_index: Dict[str, List[int]] = {}
        self._index     = None   # lazy-built

        self._dir.mkdir(parents=True, exist_ok=True)
        self._load_or_create()

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _build_index(self) -> None:
        """Create an empty FAISS flat inner-product index."""
        import faiss
        self._index = faiss.IndexFlatIP(self._dim)

    def _load_or_create(self) -> None:
        idx_path  = self._dir / _INDEX_FILE
        meta_path = self._dir / _META_FILE

        if idx_path.exists() and meta_path.exists():
            try:
                import faiss
                self._index = faiss.read_index(str(idx_path))
                with open(meta_path, "rb") as fh:
                    meta = pickle.load(fh)
                self._chunks    = meta["chunks"]
                self._doc_index = meta["doc_index"]
                logger.info(
                    f"FAISS store loaded: {self._index.ntotal} vectors, "
                    f"{len(self._doc_index)} documents"
                )
                return
            except Exception as exc:
                logger.warning(f"Could not load FAISS store, rebuilding: {exc}")

        self._build_index()
        logger.info("New FAISS store created")

    def _persist(self) -> None:
        import faiss
        faiss.write_index(self._index, str(self._dir / _INDEX_FILE))
        with open(self._dir / _META_FILE, "wb") as fh:
            pickle.dump(
                {"chunks": self._chunks, "doc_index": self._doc_index}, fh
            )

    # ── Public API ────────────────────────────────────────────────────────────

    @property
    def total_vectors(self) -> int:
        return self._index.ntotal if self._index else 0

    @property
    def document_ids(self) -> List[str]:
        return list(self._doc_index.keys())

    def add_chunks(self, chunks: List[DocumentChunk], vectors: np.ndarray) -> None:
        """
        Add document chunks and their pre-computed embeddings.

        vectors must be L2-normalised float32 of shape (len(chunks), dim).
        """
        if len(chunks) != vectors.shape[0]:
            raise ValueError("chunks and vectors length mismatch")

        with self._lock:
            start_idx = len(self._chunks)
            self._index.add(vectors)
            self._chunks.extend(chunks)

            for offset, chunk in enumerate(chunks):
                row = start_idx + offset
                self._doc_index.setdefault(chunk.doc_id, []).append(row)

            self._persist()
            logger.debug(f"Added {len(chunks)} vectors; total={self.total_vectors}")

    def search(
        self,
        query_vector: np.ndarray,
        top_k: int = 10,
        doc_ids: Optional[List[str]] = None,
    ) -> List[Tuple[DocumentChunk, float]]:
        """
        Return top-k (chunk, score) pairs.

        If doc_ids is provided, only chunks from those documents are returned.
        """
        if self.total_vectors == 0:
            return []

        with self._lock:
            # Search more than top_k when filtering so we have enough candidates
            search_k = min(self.total_vectors, top_k * 10 if doc_ids else top_k)
            qv = query_vector.reshape(1, -1).astype(np.float32)
            scores, indices = self._index.search(qv, search_k)

        results: List[Tuple[DocumentChunk, float]] = []
        seen: set = set()
        allowed_rows: Optional[set] = None

        if doc_ids:
            allowed_rows = set()
            for did in doc_ids:
                allowed_rows.update(self._doc_index.get(did, []))

        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            if allowed_rows is not None and idx not in allowed_rows:
                continue
            if idx in seen:
                continue
            seen.add(idx)
            results.append((self._chunks[idx], float(score)))
            if len(results) >= top_k:
                break

        return results

    def delete_document(self, doc_id: str) -> int:
        """
        Remove all chunks belonging to doc_id.

        FAISS flat indexes don't support in-place deletion, so we rebuild
        the index from the remaining vectors.
        """
        with self._lock:
            rows_to_delete = set(self._doc_index.get(doc_id, []))
            if not rows_to_delete:
                return 0

            # Collect surviving chunks and their vectors
            surviving_indices = [
                i for i in range(len(self._chunks)) if i not in rows_to_delete
            ]
            if surviving_indices:
                old_vectors = self._reconstruct_all_vectors()
                new_vectors = old_vectors[surviving_indices]
                new_chunks  = [self._chunks[i] for i in surviving_indices]
            else:
                new_vectors = np.empty((0, self._dim), dtype=np.float32)
                new_chunks  = []

            # Rebuild index
            self._build_index()
            if len(new_vectors) > 0:
                self._index.add(new_vectors)

            self._chunks = new_chunks

            # Rebuild doc_index with remapped row numbers
            self._doc_index = {}
            for new_row, chunk in enumerate(self._chunks):
                self._doc_index.setdefault(chunk.doc_id, []).append(new_row)

            self._persist()
            deleted = len(rows_to_delete)
            logger.info(f"Deleted {deleted} vectors for doc_id={doc_id}")
            return deleted

    def _reconstruct_all_vectors(self) -> np.ndarray:
        """Reconstruct all stored vectors from the FAISS index."""
        import faiss
        n = self._index.ntotal
        vectors = np.empty((n, self._dim), dtype=np.float32)
        self._index.reconstruct_n(0, n, vectors)
        return vectors

    def get_chunks_for_doc(self, doc_id: str) -> List[DocumentChunk]:
        rows = self._doc_index.get(doc_id, [])
        return [self._chunks[r] for r in rows]
