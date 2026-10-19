"""
Integration tests for FastAPI endpoints using the TestClient.

Heavy services (embedder, LLM) are replaced with stubs via the
`test_client` fixture in conftest.py.
"""
from __future__ import annotations

import io
from pathlib import Path

import pytest


# ── Health ────────────────────────────────────────────────────────────────────

class TestHealthEndpoint:
    def test_health_returns_ok(self, test_client):
        response = test_client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "documents_indexed" in data

    def test_root_returns_message(self, test_client):
        response = test_client.get("/api/")
        assert response.status_code == 200
        assert "DocSearch AI" in response.json()["message"]


# ── Document upload ───────────────────────────────────────────────────────────

class TestDocumentUpload:
    def _txt_file(self, content: str = "Sample text for testing."):
        return ("files", ("test.txt", io.BytesIO(content.encode()), "text/plain"))

    def test_upload_txt_success(self, test_client):
        response = test_client.post(
            "/api/documents/upload",
            files=[self._txt_file("Hello world. This is a test document with some content.")],
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data) == 1
        assert data[0]["filename"] == "test.txt"
        assert data[0]["total_chunks"] >= 1
        assert "doc_id" in data[0]

    def test_upload_multiple_files(self, test_client):
        files = [
            self._txt_file("Document one content here with multiple words."),
            ("files", ("doc2.txt", io.BytesIO(b"Document two content."), "text/plain")),
        ]
        response = test_client.post("/api/documents/upload", files=files)
        assert response.status_code == 201
        assert len(response.json()) == 2

    def test_upload_no_files_rejected(self, test_client):
        response = test_client.post("/api/documents/upload")
        assert response.status_code in (400, 422)

    def test_upload_unsupported_extension_rejected(self, test_client):
        response = test_client.post(
            "/api/documents/upload",
            files=[("files", ("data.csv", io.BytesIO(b"a,b,c"), "text/csv"))],
        )
        assert response.status_code == 422

    def test_upload_returns_doc_id(self, test_client):
        response = test_client.post(
            "/api/documents/upload",
            files=[self._txt_file("Content for doc id test.")],
        )
        data = response.json()
        assert data[0]["doc_id"] != ""


# ── Document list / get / delete ──────────────────────────────────────────────

class TestDocumentManagement:
    def _upload_one(self, client, content="Test document content."):
        r = client.post(
            "/api/documents/upload",
            files=[("files", ("test.txt", io.BytesIO(content.encode()), "text/plain"))],
        )
        assert r.status_code == 201
        return r.json()[0]["doc_id"]

    def test_list_empty_initially(self, test_client):
        response = test_client.get("/api/documents")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_list_shows_uploaded_doc(self, test_client):
        self._upload_one(test_client)
        response = test_client.get("/api/documents")
        assert response.status_code == 200
        assert len(response.json()) >= 1

    def test_get_document_by_id(self, test_client):
        doc_id = self._upload_one(test_client)
        response = test_client.get(f"/api/documents/{doc_id}")
        assert response.status_code == 200
        assert response.json()["doc_id"] == doc_id

    def test_get_nonexistent_document_returns_404(self, test_client):
        response = test_client.get("/api/documents/nonexistent-id")
        assert response.status_code == 404

    def test_delete_document(self, test_client):
        doc_id = self._upload_one(test_client)
        response = test_client.delete(f"/api/documents/{doc_id}")
        assert response.status_code == 200
        assert response.json()["doc_id"] == doc_id
        # Confirm it's gone
        get_response = test_client.get(f"/api/documents/{doc_id}")
        assert get_response.status_code == 404

    def test_delete_nonexistent_returns_404(self, test_client):
        response = test_client.delete("/api/documents/ghost-id")
        assert response.status_code == 404


# ── Search endpoint ───────────────────────────────────────────────────────────

class TestSearchEndpoint:
    def _upload_doc(self, client):
        content = (
            "Artificial intelligence enables machines to simulate human reasoning. "
            "Machine learning is a core technique used in modern AI systems. "
            "Deep learning models use neural networks with many layers."
        )
        r = client.post(
            "/api/documents/upload",
            files=[("files", ("ai.txt", io.BytesIO(content.encode()), "text/plain"))],
        )
        assert r.status_code == 201

    def test_search_returns_answer(self, test_client):
        self._upload_doc(test_client)
        response = test_client.post(
            "/api/search",
            json={"query": "What is machine learning?", "top_k": 3},
        )
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert "citations" in data
        assert "latency_ms" in data
        assert data["latency_ms"] > 0

    def test_search_empty_query_rejected(self, test_client):
        response = test_client.post("/api/search", json={"query": ""})
        assert response.status_code in (400, 422)

    def test_search_get_endpoint(self, test_client):
        self._upload_doc(test_client)
        response = test_client.get("/api/search?q=What+is+AI&top_k=3")
        assert response.status_code == 200

    def test_search_response_structure(self, test_client):
        self._upload_doc(test_client)
        response = test_client.post(
            "/api/search",
            json={"query": "deep learning", "top_k": 2, "hybrid_alpha": 0.7},
        )
        data = response.json()
        assert "answer" in data
        assert "citations" in data
        assert "retrieved_passages" in data
        assert "query" in data
        assert data["query"] == "deep learning"

    def test_search_with_no_documents_returns_sentinel(self, test_client):
        """Without documents the LLM stub still returns its canned response."""
        response = test_client.post(
            "/api/search",
            json={"query": "What is quantum computing?"},
        )
        # Should succeed (200) even if no docs are loaded — sentinel is returned
        assert response.status_code == 200


# ── Input validation ──────────────────────────────────────────────────────────

class TestInputValidation:
    def test_top_k_out_of_range_rejected(self, test_client):
        response = test_client.post(
            "/api/search",
            json={"query": "test", "top_k": 100},
        )
        assert response.status_code == 422

    def test_alpha_out_of_range_rejected(self, test_client):
        response = test_client.post(
            "/api/search",
            json={"query": "test", "hybrid_alpha": 1.5},
        )
        assert response.status_code == 422
