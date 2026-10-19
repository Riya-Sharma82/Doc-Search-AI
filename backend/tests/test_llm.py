"""Tests for LLM prompt building and answer generation logic."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.models.document import Citation
from app.services.llm import (
    NO_ANSWER_SENTINEL,
    GeminiLLMService,
    _build_user_message,
    _format_passages,
    _trim_history,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_citation(filename="doc.pdf", page=1, passage="Some relevant text.") -> Citation:
    return Citation(
        doc_id="doc-001",
        filename=filename,
        page_number=page,
        chunk_index=0,
        passage=passage,
        score=0.9,
    )


# ── _format_passages ──────────────────────────────────────────────────────────

class TestFormatPassages:
    def test_includes_filename_and_page(self):
        cit = _make_citation(filename="report.pdf", page=3, passage="Important finding.")
        text = _format_passages([cit])
        assert "report.pdf" in text
        assert "Page 3" in text
        assert "Important finding." in text

    def test_numbers_passages(self):
        citations = [_make_citation() for _ in range(3)]
        text = _format_passages(citations)
        assert "[1]" in text
        assert "[2]" in text
        assert "[3]" in text

    def test_truncates_long_passage(self):
        long_text = "word " * 500
        cit = _make_citation(passage=long_text)
        text = _format_passages([cit])
        assert len(text) < len(long_text) * 2   # passage was truncated

    def test_empty_citations_returns_empty(self):
        assert _format_passages([]) == ""


# ── _build_user_message ───────────────────────────────────────────────────────

class TestBuildUserMessage:
    def test_contains_query(self):
        msg = _build_user_message("What is AI?", "Some context.")
        assert "What is AI?" in msg

    def test_contains_passages(self):
        msg = _build_user_message("q", "Passage content here.")
        assert "Passage content here." in msg


# ── _trim_history ─────────────────────────────────────────────────────────────

class TestTrimHistory:
    def test_short_history_unchanged(self):
        history = [{"role": "user", "parts": ["hi"]}, {"role": "model", "parts": ["hello"]}]
        assert _trim_history(history, max_turns=6) == history

    def test_long_history_trimmed(self):
        history = [{"role": "user" if i % 2 == 0 else "model", "parts": [str(i)]}
                   for i in range(20)]
        trimmed = _trim_history(history, max_turns=3)
        assert len(trimmed) == 6   # 3 turns × 2 messages each

    def test_empty_history_unchanged(self):
        assert _trim_history([], max_turns=6) == []


# ── GeminiLLMService ──────────────────────────────────────────────────────────

class TestGeminiLLMService:
    def test_returns_sentinel_when_no_citations(self):
        svc = GeminiLLMService(api_key="fake-key")
        result = svc.answer("What is X?", citations=[])
        assert result == NO_ANSWER_SENTINEL

    def test_returns_config_error_when_no_api_key(self):
        svc = GeminiLLMService(api_key="")
        result = svc.answer("What is X?", citations=[_make_citation()])
        assert "API key" in result.lower() or "configured" in result.lower()

    def test_calls_gemini_with_context(self):
        svc = GeminiLLMService(api_key="fake-key")

        # Mock the Gemini GenerativeModel so no real HTTP call is made
        mock_chat    = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "The answer is 42."
        mock_chat.send_message.return_value = mock_response

        mock_model = MagicMock()
        mock_model.start_chat.return_value = mock_chat

        svc._client = mock_model

        citations = [_make_citation(passage="The answer is 42.")]
        result = svc.answer("What is the answer?", citations=citations)
        assert result == "The answer is 42."
        mock_model.start_chat.assert_called_once()

    def test_returns_error_message_on_api_failure(self):
        svc = GeminiLLMService(api_key="fake-key")

        mock_model = MagicMock()
        mock_model.start_chat.side_effect = RuntimeError("API unavailable")
        svc._client = mock_model

        result = svc.answer("question?", citations=[_make_citation()])
        assert "error" in result.lower()
