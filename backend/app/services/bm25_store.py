"""
BM25 keyword search store.

Maintains a rank-bm25 BM25Okapi index alongside a mapping from BM25
corpus positions to DocumentChunk objects.  The index is rebuilt from
the stored corpus every time a document is added or deleted (the corpus
is small enough in practice; if it grows very large you can switch to
an incremental approach).

Thread-safety: a threading.Lock guards all mutations.
"""
from __future__ import annotations

import pickle
import re
import threading
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from loguru import logger

from app.models.document import DocumentChunk


_BM25_FILE = "bm25_store.pkl"


def _tokenize(text: str) -> List[str]:
    """Lowercase, strip punctuation, split on whitespace."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return text.split()


class BM25Store:
    def __init__(self, persist_dir: Path) -> None:
        self._dir    = persist_dir
        self._lock   = threading.Lock()
        self._corpus: List[List[str]]     = []   # tokenised chunk texts
        self._chunks: List[DocumentChunk] = []   # parallel list
        self._doc_index: Dict[str, List[int]] = {}  # doc_id → corpus positions
        self._bm25   = None   # rank_bm25.BM25Okapi, rebuilt on change

        self._dir.mkdir(parents=True, exist_ok=True)
        self._load_or_create()

    # ── Persistence ───────────────────────────────────────────────────────────

    def _persist(self) -> None:
        path = self._dir / _BM25_FILE
        with open(path, "wb") as fh:
            pickle.dump(
                {
                    "corpus":    self._corpus,
                    "chunks":    self._chunks,
                    "doc_index": self._doc_index,
                },
                fh,
            )

    def _load_or_create(self) -> None:
        path = self._dir / _BM25_FILE
        if path.exists():
            try:
                with open(path, "rb") as fh:
                    data = pickle.load(fh)
                self._corpus    = data["corpus"]
                self._chunks    = data["chunks"]
                self._doc_index = data["doc_index"]
                self._rebuild_index()
                logger.info(
                    f"BM25 store loaded: {len(self._corpus)} chunks, "
                    f"{len(self._doc_index)} documents"
                )
                return
            except Exception as exc:
                logger.warning(f"Could not load BM25 store, rebuilding: {exc}")

        logger.info("New BM25 store created")

    def _rebuild_index(self) -> None:
        if not self._corpus:
            self._bm25 = None
            return
        from rank_bm25 import BM25Okapi
        self._bm25 = BM25Okapi(self._corpus)

    # ── Public API ────────────────────────────────────────────────────────────

    @property
    def total_chunks(self) -> int:
        return len(self._chunks)

    def add_chunks(self, chunks: List[DocumentChunk]) -> None:
        with self._lock:
            start = len(self._chunks)
            for offset, chunk in enumerate(chunks):
                tokens = _tokenize(chunk.text)
                self._corpus.append(tokens)
                self._chunks.append(chunk)
                self._doc_index.setdefault(chunk.doc_id, []).append(start + offset)
            self._rebuild_index()
            self._persist()
            logger.debug(f"BM25: added {len(chunks)} chunks; total={self.total_chunks}")

    def search(
        self,
        query: str,
        top_k: int = 10,
        doc_ids: Optional[List[str]] = None,
    ) -> List[Tuple[DocumentChunk, float]]:
        """Return top-k (chunk, bm25_score) pairs."""
        with self._lock:
            if self._bm25 is None or not self._corpus:
                return []

            query_tokens = _tokenize(query)
            if not query_tokens:
                return []

            scores = self._bm25.get_scores(query_tokens)

            # Build candidate list, optionally filtered by doc_ids
            allowed_positions: Optional[set] = None
            if doc_ids:
                allowed_positions = set()
                for did in doc_ids:
                    allowed_positions.update(self._doc_index.get(did, []))

            candidates: List[Tuple[int, float]] = []
            for i, score in enumerate(scores):
                if allowed_positions is not None and i not in allowed_positions:
                    continue
                candidates.append((i, float(score)))

            # Sort descending by score
            candidates.sort(key=lambda x: x[1], reverse=True)
            top = candidates[:top_k]

            return [(self._chunks[i], s) for i, s in top]

    def delete_document(self, doc_id: str) -> int:
        with self._lock:
            positions = set(self._doc_index.get(doc_id, []))
            if not positions:
                return 0

            surviving = [
                i for i in range(len(self._chunks)) if i not in positions
            ]
            new_chunks = [self._chunks[i] for i in surviving]
            new_corpus = [self._corpus[i] for i in surviving]

            self._chunks    = new_chunks
            self._corpus    = new_corpus
            self._doc_index = {}
            for new_pos, chunk in enumerate(self._chunks):
                self._doc_index.setdefault(chunk.doc_id, []).append(new_pos)

            self._rebuild_index()
            self._persist()
            deleted = len(positions)
            logger.info(f"BM25: removed {deleted} chunks for doc_id={doc_id}")
            return deleted
