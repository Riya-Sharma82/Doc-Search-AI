"""
Shared pytest fixtures.

All fixtures that need disk access use tmp_path so tests stay isolated
and never touch the real data/ directory.
"""
from __future__ import annotations

import textwrap
from pathlib import Path
from typing import List
from unittest.mock import MagicMock

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.models.document import DocumentChunk


# ── Tiny deterministic embedding stub ────────────────────────────────────────

class StubEmbedder:
    """Returns consistent random-but-deterministic vectors based on text hash."""

    dimension = 64

    def embed(self, texts: List[str], **kwargs) -> np.ndarray:
        rng = np.random.default_rng(seed=42)
        vecs = rng.random((len(texts), self.dimension)).astype(np.float32)
        # L2 normalise so FAISS inner-product == cosine
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        return vecs / (norms + 1e-9)

    def embed_query(self, query: str) -> np.ndarray:
        return self.embed([query])[0]


# ── Sample text fixtures ──────────────────────────────────────────────────────

@pytest.fixture
def sample_txt_file(tmp_path: Path) -> Path:
    content = textwrap.dedent("""\
        Artificial intelligence (AI) is the simulation of human intelligence
        by machines. Machine learning is a subset of AI that allows systems to
        learn from data. Deep learning uses neural networks with many layers.

        Natural language processing (NLP) enables computers to understand text.
        Large language models (LLMs) are trained on massive text corpora.
        They can generate coherent and contextually appropriate text.

        Vector databases store high-dimensional embeddings and support
        approximate nearest-neighbour search. FAISS is a popular library
        developed by Meta for efficient similarity search.
    """)
    p = tmp_path / "sample.txt"
    p.write_text(content, encoding="utf-8")
    return p


@pytest.fixture
def sample_docx_file(tmp_path: Path) -> Path:
    """Create a minimal DOCX in tmp_path."""
    from docx import Document
    doc = Document()
    doc.add_heading("Test Document", level=1)
    doc.add_paragraph(
        "This is the first paragraph about machine learning and AI systems."
    )
    doc.add_paragraph(
        "The second paragraph discusses vector embeddings and semantic search."
    )
    doc.add_paragraph(
        "FAISS is used for efficient nearest-neighbour retrieval in high dimensions."
    )
    path = tmp_path / "sample.docx"
    doc.save(str(path))
    return path


@pytest.fixture
def stub_embedder() -> StubEmbedder:
    return StubEmbedder()


@pytest.fixture
def sample_chunks(stub_embedder) -> List[DocumentChunk]:
    texts = [
        "Artificial intelligence is the simulation of human intelligence by machines.",
        "Machine learning allows systems to learn from data without explicit programming.",
        "Deep learning uses multi-layer neural networks for complex pattern recognition.",
        "Natural language processing enables computers to understand and generate text.",
        "Vector databases store embeddings and support fast similarity search.",
    ]
    return [
        DocumentChunk(
            doc_id="doc-test-001",
            filename="sample.txt",
            page_number=1,
            chunk_index=i,
            text=t,
        )
        for i, t in enumerate(texts)
    ]


@pytest.fixture
def sample_vectors(sample_chunks, stub_embedder) -> np.ndarray:
    return stub_embedder.embed([c.text for c in sample_chunks])


# ── FastAPI test client ────────────────────────────────────────────────────────

@pytest.fixture
def test_client(tmp_path):
    """
    Return a TestClient with all heavy services (embedder, LLM) stubbed out
    using FastAPI's dependency_overrides — the correct way to swap Depends()
    callables so overrides are active during every request.
    """
    from app.services.bm25_store import BM25Store
    from app.services.document_registry import DocumentRegistry
    from app.services.ingestion import IngestionService
    from app.services.llm import AnswerService
    from app.services.retriever import HybridRetriever
    from app.services.vector_store import FAISSVectorStore
    import app.core.dependencies as deps

    embedder  = StubEmbedder()
    vs        = FAISSVectorStore(persist_dir=tmp_path / "vs", dimension=embedder.dimension)
    bm25      = BM25Store(persist_dir=tmp_path / "bm25")
    registry  = DocumentRegistry(persist_dir=tmp_path / "reg")
    ingestion = IngestionService(
        vector_store=vs, bm25_store=bm25, registry=registry, embedder=embedder,
    )
    retriever = HybridRetriever(
        vector_store=vs, bm25_store=bm25, embedder=embedder, reranker=None,
    )
    mock_llm  = MagicMock()
    mock_llm.answer.return_value = "Test answer based on documents."
    answer_svc = AnswerService(retriever=retriever, llm=mock_llm)

    # Build the app fresh (no cached singletons leaking between tests)
    deps.get_embedder.cache_clear()
    deps.get_vector_store.cache_clear()
    deps.get_bm25_store.cache_clear()
    deps.get_registry.cache_clear()
    deps.get_retriever.cache_clear()
    deps.get_llm.cache_clear()
    deps.get_answer_service.cache_clear()
    deps.get_ingestion_service.cache_clear()
    deps.get_reranker.cache_clear()

    import os
    os.environ["DOCSEARCH_TESTING"] = "1"

    from app.main import create_app
    application = create_app()

    # FastAPI dependency_overrides: these callables are invoked by Depends()
    application.dependency_overrides[deps.get_registry]         = lambda: registry
    application.dependency_overrides[deps.get_vector_store]     = lambda: vs
    application.dependency_overrides[deps.get_bm25_store]       = lambda: bm25
    application.dependency_overrides[deps.get_embedder]         = lambda: embedder
    application.dependency_overrides[deps.get_retriever]        = lambda: retriever
    application.dependency_overrides[deps.get_llm]              = lambda: mock_llm
    application.dependency_overrides[deps.get_answer_service]   = lambda: answer_svc
    application.dependency_overrides[deps.get_ingestion_service]= lambda: ingestion

    with TestClient(application, raise_server_exceptions=True) as client:
        yield client
