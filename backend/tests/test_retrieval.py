"""Tests for vector store, BM25 store, RRF fusion, and hybrid retriever."""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from app.models.document import DocumentChunk
from app.services.bm25_store import BM25Store, _tokenize
from app.services.retriever import HybridRetriever, reciprocal_rank_fusion
from app.services.vector_store import FAISSVectorStore


# ── Tokeniser ─────────────────────────────────────────────────────────────────

class TestTokenize:
    def test_lowercases(self):
        assert _tokenize("Hello World") == ["hello", "world"]

    def test_removes_punctuation(self):
        tokens = _tokenize("AI, ML & NLP!")
        assert "," not in tokens
        assert "&" not in tokens
        assert "!" not in tokens

    def test_empty_string(self):
        assert _tokenize("") == []


# ── FAISS vector store ────────────────────────────────────────────────────────

class TestFAISSVectorStore:
    def test_add_and_search(self, tmp_path, sample_chunks, sample_vectors):
        vs = FAISSVectorStore(persist_dir=tmp_path, dimension=sample_vectors.shape[1])
        vs.add_chunks(sample_chunks, sample_vectors)

        assert vs.total_vectors == len(sample_chunks)

        query_vec = sample_vectors[0]
        results = vs.search(query_vec, top_k=3)
        assert len(results) <= 3
        assert all(isinstance(r[0], DocumentChunk) for r in results)
        assert all(isinstance(r[1], float) for r in results)

    def test_scores_descending(self, tmp_path, sample_chunks, sample_vectors):
        vs = FAISSVectorStore(persist_dir=tmp_path, dimension=sample_vectors.shape[1])
        vs.add_chunks(sample_chunks, sample_vectors)
        results = vs.search(sample_vectors[0], top_k=5)
        scores = [r[1] for r in results]
        assert scores == sorted(scores, reverse=True)

    def test_delete_document(self, tmp_path, sample_chunks, sample_vectors):
        vs = FAISSVectorStore(persist_dir=tmp_path, dimension=sample_vectors.shape[1])
        vs.add_chunks(sample_chunks, sample_vectors)
        before = vs.total_vectors
        deleted = vs.delete_document("doc-test-001")
        assert deleted == len(sample_chunks)
        assert vs.total_vectors == 0

    def test_search_empty_store(self, tmp_path):
        vs = FAISSVectorStore(persist_dir=tmp_path, dimension=64)
        results = vs.search(np.random.rand(64).astype(np.float32), top_k=5)
        assert results == []

    def test_filter_by_doc_id(self, tmp_path, sample_chunks, sample_vectors, stub_embedder):
        # Add a second set of chunks under a different doc_id
        extra_chunks = [
            DocumentChunk(
                doc_id="doc-other",
                filename="other.txt",
                page_number=1,
                chunk_index=i,
                text=f"Extra chunk {i}",
            )
            for i in range(3)
        ]
        extra_vecs = stub_embedder.embed([c.text for c in extra_chunks])

        vs = FAISSVectorStore(persist_dir=tmp_path, dimension=sample_vectors.shape[1])
        vs.add_chunks(sample_chunks, sample_vectors)
        vs.add_chunks(extra_chunks, extra_vecs)

        results = vs.search(sample_vectors[0], top_k=10, doc_ids=["doc-other"])
        assert all(r[0].doc_id == "doc-other" for r in results)

    def test_persistence(self, tmp_path, sample_chunks, sample_vectors):
        vs1 = FAISSVectorStore(persist_dir=tmp_path, dimension=sample_vectors.shape[1])
        vs1.add_chunks(sample_chunks, sample_vectors)
        del vs1

        vs2 = FAISSVectorStore(persist_dir=tmp_path, dimension=sample_vectors.shape[1])
        assert vs2.total_vectors == len(sample_chunks)


# ── BM25 store ────────────────────────────────────────────────────────────────

class TestBM25Store:
    def test_add_and_search(self, tmp_path, sample_chunks):
        bm25 = BM25Store(persist_dir=tmp_path)
        bm25.add_chunks(sample_chunks)

        results = bm25.search("machine learning neural network", top_k=3)
        assert len(results) <= 3
        assert all(isinstance(r[0], DocumentChunk) for r in results)

    def test_returns_relevant_chunk(self, tmp_path, sample_chunks):
        bm25 = BM25Store(persist_dir=tmp_path)
        bm25.add_chunks(sample_chunks)
        # "embeddings" appears in the last chunk
        results = bm25.search("vector embeddings similarity", top_k=5)
        top_texts = [r[0].text for r in results]
        assert any("embedding" in t.lower() or "vector" in t.lower() for t in top_texts)

    def test_delete_document(self, tmp_path, sample_chunks):
        bm25 = BM25Store(persist_dir=tmp_path)
        bm25.add_chunks(sample_chunks)
        bm25.delete_document("doc-test-001")
        assert bm25.total_chunks == 0

    def test_search_empty(self, tmp_path):
        bm25 = BM25Store(persist_dir=tmp_path)
        assert bm25.search("anything") == []

    def test_persistence(self, tmp_path, sample_chunks):
        bm25a = BM25Store(persist_dir=tmp_path)
        bm25a.add_chunks(sample_chunks)
        del bm25a

        bm25b = BM25Store(persist_dir=tmp_path)
        assert bm25b.total_chunks == len(sample_chunks)


# ── RRF fusion ────────────────────────────────────────────────────────────────

class TestRRF:
    def _make_chunks(self, n: int) -> list:
        return [
            DocumentChunk(
                doc_id="d",
                filename="f.txt",
                page_number=1,
                chunk_index=i,
                text=f"chunk {i}",
            )
            for i in range(n)
        ]

    def test_single_list_preserves_order(self):
        chunks = self._make_chunks(5)
        ranked = [(c, float(5 - i)) for i, c in enumerate(chunks)]
        result = reciprocal_rank_fusion([ranked], top_k=5)
        result_ids = [c.chunk_index for c, _ in result]
        assert result_ids == list(range(5))

    def test_fuses_two_lists(self):
        chunks = self._make_chunks(5)
        list_a = [(chunks[i], 1.0) for i in [0, 1, 2, 3, 4]]
        list_b = [(chunks[i], 1.0) for i in [4, 3, 2, 1, 0]]
        result = reciprocal_rank_fusion([list_a, list_b], top_k=5)
        # All 5 chunks should appear
        assert len(result) == 5

    def test_top_k_respected(self):
        chunks = self._make_chunks(10)
        ranked = [(c, 1.0) for c in chunks]
        result = reciprocal_rank_fusion([ranked], top_k=3)
        assert len(result) == 3

    def test_empty_lists_return_empty(self):
        assert reciprocal_rank_fusion([]) == []

    def test_weights_influence_ranking(self):
        """The list with higher weight should dominate."""
        chunks = self._make_chunks(4)
        # List A ranks chunk 0 first; list B ranks chunk 3 first
        list_a = [(chunks[0], 1.0), (chunks[1], 0.8)]
        list_b = [(chunks[3], 1.0), (chunks[2], 0.8)]
        # High weight on A → chunk 0 should win
        result_a_heavy = reciprocal_rank_fusion([list_a, list_b], weights=[0.9, 0.1], top_k=4)
        # High weight on B → chunk 3 should win
        result_b_heavy = reciprocal_rank_fusion([list_a, list_b], weights=[0.1, 0.9], top_k=4)
        assert result_a_heavy[0][0].chunk_index == 0
        assert result_b_heavy[0][0].chunk_index == 3


# ── Hybrid retriever ──────────────────────────────────────────────────────────

class TestHybridRetriever:
    def test_returns_citations(self, tmp_path, sample_chunks, sample_vectors, stub_embedder):
        vs = FAISSVectorStore(persist_dir=tmp_path / "vs", dimension=stub_embedder.dimension)
        vs.add_chunks(sample_chunks, sample_vectors)
        bm25 = BM25Store(persist_dir=tmp_path / "bm25")
        bm25.add_chunks(sample_chunks)

        retriever = HybridRetriever(vs, bm25, stub_embedder)
        citations, latency = retriever.retrieve("machine learning neural network", top_k=3)

        assert len(citations) <= 3
        assert latency > 0
        for cit in citations:
            assert cit.doc_id == "doc-test-001"
            assert cit.score >= 0.0

    def test_semantic_only(self, tmp_path, sample_chunks, sample_vectors, stub_embedder):
        vs = FAISSVectorStore(persist_dir=tmp_path / "vs", dimension=stub_embedder.dimension)
        vs.add_chunks(sample_chunks, sample_vectors)
        bm25 = BM25Store(persist_dir=tmp_path / "bm25")
        bm25.add_chunks(sample_chunks)

        retriever = HybridRetriever(vs, bm25, stub_embedder)
        citations, _ = retriever.retrieve("query", top_k=5, alpha=1.0)
        assert len(citations) <= 5

    def test_bm25_only(self, tmp_path, sample_chunks, sample_vectors, stub_embedder):
        vs = FAISSVectorStore(persist_dir=tmp_path / "vs", dimension=stub_embedder.dimension)
        vs.add_chunks(sample_chunks, sample_vectors)
        bm25 = BM25Store(persist_dir=tmp_path / "bm25")
        bm25.add_chunks(sample_chunks)

        retriever = HybridRetriever(vs, bm25, stub_embedder)
        citations, _ = retriever.retrieve("embeddings", top_k=5, alpha=0.0)
        assert len(citations) <= 5

    def test_empty_store_returns_empty(self, tmp_path, stub_embedder):
        vs = FAISSVectorStore(persist_dir=tmp_path / "vs", dimension=stub_embedder.dimension)
        bm25 = BM25Store(persist_dir=tmp_path / "bm25")
        retriever = HybridRetriever(vs, bm25, stub_embedder)
        citations, _ = retriever.retrieve("anything")
        assert citations == []
