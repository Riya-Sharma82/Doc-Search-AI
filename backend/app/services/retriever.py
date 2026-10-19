"""
Hybrid retrieval pipeline.

Steps
-----
1. Run semantic search (FAISS) and BM25 keyword search in parallel.
2. Fuse ranked lists with Reciprocal Rank Fusion (RRF).
3. Optionally rerank the top-k candidates with a cross-encoder.
4. Return Citation objects ready for the LLM.

Reciprocal Rank Fusion
----------------------
  RRF(d) = Σ  1 / (k + rank_i(d))

where k=60 is the standard smoothing constant and rank_i(d) is the
1-based position of document d in result list i.

alpha parameter
---------------
  alpha=1.0  → semantic only (BM25 weight = 0)
  alpha=0.0  → BM25 only    (semantic weight = 0)
  alpha=0.5  → equal weight (default)
"""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple

import numpy as np
from loguru import logger

from app.models.document import Citation, DocumentChunk
from app.services.bm25_store import BM25Store
from app.services.embedder import EmbeddingService
from app.services.vector_store import FAISSVectorStore


_RRF_K = 60   # standard RRF smoothing constant


# ── RRF fusion ────────────────────────────────────────────────────────────────

def reciprocal_rank_fusion(
    ranked_lists: List[List[Tuple[DocumentChunk, float]]],
    weights: Optional[List[float]] = None,
    top_k: int = 10,
) -> List[Tuple[DocumentChunk, float]]:
    """
    Merge multiple ranked lists into one using weighted RRF.

    Parameters
    ----------
    ranked_lists : each list is [(chunk, original_score), ...] in rank order.
    weights      : per-list multiplier; defaults to equal weights.
    top_k        : number of results to return.

    Returns
    -------
    [(chunk, rrf_score), ...] sorted descending.
    """
    if not ranked_lists:
        return []

    n = len(ranked_lists)
    weights = weights if weights and len(weights) == n else [1.0] * n

    # chunk_id → (chunk, accumulated_rrf_score)
    scores: Dict[str, Tuple[DocumentChunk, float]] = {}

    for ranked, weight in zip(ranked_lists, weights):
        for rank_idx, (chunk, _) in enumerate(ranked):
            cid = chunk.chunk_id
            rrf_contribution = weight / (_RRF_K + rank_idx + 1)
            if cid in scores:
                scores[cid] = (chunk, scores[cid][1] + rrf_contribution)
            else:
                scores[cid] = (chunk, rrf_contribution)

    fused = sorted(scores.values(), key=lambda x: x[1], reverse=True)
    return fused[:top_k]


# ── Cross-encoder reranker ────────────────────────────────────────────────────

class CrossEncoderReranker:
    """Lazy-loaded cross-encoder for precise relevance scoring."""

    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2") -> None:
        self.model_name = model_name
        self._model = None

    def _load(self) -> None:
        if self._model is None:
            from sentence_transformers import CrossEncoder
            logger.info(f"Loading cross-encoder '{self.model_name}' …")
            self._model = CrossEncoder(self.model_name)
            logger.info("Cross-encoder loaded")

    def rerank(
        self,
        query: str,
        candidates: List[Tuple[DocumentChunk, float]],
        top_k: int = 5,
    ) -> List[Tuple[DocumentChunk, float]]:
        if not candidates:
            return []

        self._load()
        pairs = [(query, chunk.text) for chunk, _ in candidates]
        ce_scores: List[float] = self._model.predict(pairs).tolist()

        reranked = sorted(
            zip([c for c, _ in candidates], ce_scores),
            key=lambda x: x[1],
            reverse=True,
        )
        return reranked[:top_k]


# ── Main retriever ────────────────────────────────────────────────────────────

class HybridRetriever:
    """
    Orchestrates semantic + BM25 search, RRF fusion, and optional reranking.
    """

    def __init__(
        self,
        vector_store: FAISSVectorStore,
        bm25_store: BM25Store,
        embedder: EmbeddingService,
        reranker: Optional[CrossEncoderReranker] = None,
    ) -> None:
        self._vs       = vector_store
        self._bm25     = bm25_store
        self._embedder = embedder
        self._reranker = reranker

    def retrieve(
        self,
        query: str,
        top_k: int = 10,
        alpha: float = 0.5,
        enable_reranker: bool = False,
        doc_ids: Optional[List[str]] = None,
    ) -> Tuple[List[Citation], float]:
        """
        Run the full retrieval pipeline.

        Parameters
        ----------
        query           : natural-language question.
        top_k           : final number of passages to return.
        alpha           : 1.0 = semantic only, 0.0 = BM25 only.
        enable_reranker : whether to apply cross-encoder reranking.
        doc_ids         : restrict search to these document IDs.

        Returns
        -------
        (citations, latency_ms)
        """
        t0 = time.perf_counter()

        # ── 1. Embed the query ────────────────────────────────────────────────
        query_vector = self._embedder.embed_query(query)

        # ── 2. Parallel search ───────────────────────────────────────────────
        fetch_k = top_k * 4   # retrieve extra candidates before fusion

        semantic_results: List[Tuple[DocumentChunk, float]] = []
        bm25_results:     List[Tuple[DocumentChunk, float]] = []

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = {}

            if alpha > 0.0:
                futures["semantic"] = pool.submit(
                    self._vs.search, query_vector, fetch_k, doc_ids
                )
            if alpha < 1.0:
                futures["bm25"] = pool.submit(
                    self._bm25.search, query, fetch_k, doc_ids
                )

            for name, fut in futures.items():
                try:
                    if name == "semantic":
                        semantic_results = fut.result()
                    else:
                        bm25_results = fut.result()
                except Exception as exc:
                    logger.warning(f"{name} search failed: {exc}")

        # ── 3. Determine weights from alpha ──────────────────────────────────
        ranked_lists: List[List[Tuple[DocumentChunk, float]]] = []
        weights: List[float] = []

        if semantic_results:
            ranked_lists.append(semantic_results)
            weights.append(alpha)
        if bm25_results:
            ranked_lists.append(bm25_results)
            weights.append(1.0 - alpha)

        # ── 4. RRF fusion ────────────────────────────────────────────────────
        rerank_k = min(top_k * 2, 20)  # pass more candidates to reranker
        fused = reciprocal_rank_fusion(ranked_lists, weights, top_k=rerank_k)

        if not fused:
            return [], (time.perf_counter() - t0) * 1000

        # ── 5. Optional cross-encoder reranking ──────────────────────────────
        if enable_reranker and self._reranker:
            fused = self._reranker.rerank(query, fused, top_k=top_k)
        else:
            fused = fused[:top_k]

        # ── 6. Convert to Citation objects ───────────────────────────────────
        citations = [
            Citation(
                doc_id=chunk.doc_id,
                filename=chunk.filename,
                page_number=chunk.page_number,
                chunk_index=chunk.chunk_index,
                passage=chunk.text,
                score=round(score, 4),
            )
            for chunk, score in fused
        ]

        latency_ms = (time.perf_counter() - t0) * 1000
        logger.debug(
            f"Retrieval: query='{query[:60]}…' top_k={top_k} "
            f"alpha={alpha} reranker={enable_reranker} "
            f"→ {len(citations)} results in {latency_ms:.1f} ms"
        )
        return citations, latency_ms
