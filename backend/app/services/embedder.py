"""
Embedding service: wraps Sentence Transformers to produce dense vectors.

The model is loaded once at startup and reused across requests.
"""
from __future__ import annotations

from functools import lru_cache
from typing import List

import numpy as np
from loguru import logger


class EmbeddingService:
    """Thin wrapper around a SentenceTransformer model."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        self.model_name = model_name
        self._model = None

    def _load(self) -> None:
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading embedding model '{self.model_name}' …")
            self._model = SentenceTransformer(self.model_name)
            logger.info(
                f"Embedding model loaded — dim={self.dimension}"
            )

    @property
    def dimension(self) -> int:
        self._load()
        # Support both the old and new method name across sentence-transformers versions
        get_dim = getattr(
            self._model,
            "get_embedding_dimension",
            None,
        ) or getattr(self._model, "get_sentence_embedding_dimension", None)
        return get_dim()

    def embed(self, texts: List[str], batch_size: int = 64) -> np.ndarray:
        """
        Encode a list of strings into a float32 numpy array of shape (N, dim).

        Empty strings are replaced with a single space so the model never
        receives empty input.
        """
        self._load()
        safe_texts = [t if t.strip() else " " for t in texts]
        vectors = self._model.encode(
            safe_texts,
            batch_size=batch_size,
            show_progress_bar=False,
            normalize_embeddings=True,   # L2 normalise → cosine via dot product
            convert_to_numpy=True,
        )
        return vectors.astype(np.float32)

    def embed_query(self, query: str) -> np.ndarray:
        """Encode a single query string; returns shape (dim,)."""
        return self.embed([query])[0]


@lru_cache(maxsize=1)
def get_embedding_service(model_name: str = "all-MiniLM-L6-v2") -> EmbeddingService:
    """Return a singleton EmbeddingService (one per model name)."""
    return EmbeddingService(model_name)
