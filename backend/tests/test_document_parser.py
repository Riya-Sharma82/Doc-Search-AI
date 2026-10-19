"""Tests for document_parser.py — TXT, DOCX parsing and the dispatcher."""
from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from app.services.document_parser import _clean_text, parse_document, parse_txt


# ── _clean_text ───────────────────────────────────────────────────────────────

class TestCleanText:
    def test_strips_control_characters(self):
        raw = "Hello\x00World\x07!"
        result = _clean_text(raw)
        assert "\x00" not in result
        assert "\x07" not in result
        assert "Hello" in result

    def test_collapses_excessive_newlines(self):
        raw = "Line one\n\n\n\n\nLine two"
        result = _clean_text(raw)
        assert "\n\n\n" not in result

    def test_collapses_horizontal_whitespace(self):
        raw = "word1   \t   word2"
        result = _clean_text(raw)
        assert result == "word1 word2"

    def test_strips_leading_trailing_whitespace(self):
        assert _clean_text("  hello  ") == "hello"

    def test_empty_string(self):
        assert _clean_text("") == ""


# ── parse_txt ─────────────────────────────────────────────────────────────────

class TestParseTxt:
    def test_returns_pages_for_short_file(self, tmp_path: Path):
        content = "Short file content."
        p = tmp_path / "short.txt"
        p.write_text(content)
        pages = parse_txt(p)
        assert len(pages) == 1
        assert pages[0][0] == 1           # page number
        assert "Short file" in pages[0][1]

    def test_splits_long_file_into_multiple_pages(self, tmp_path: Path):
        content = "word " * 2000          # ~10 000 chars
        p = tmp_path / "long.txt"
        p.write_text(content)
        pages = parse_txt(p)
        assert len(pages) > 1

    def test_page_numbers_are_sequential(self, tmp_path: Path, sample_txt_file: Path):
        pages = parse_txt(sample_txt_file)
        for i, (page_num, _) in enumerate(pages, start=1):
            assert page_num == i

    def test_empty_file_returns_empty(self, tmp_path: Path):
        p = tmp_path / "empty.txt"
        p.write_text("")
        pages = parse_txt(p)
        assert pages == []


# ── parse_docx ────────────────────────────────────────────────────────────────

class TestParseDocx:
    def test_extracts_text(self, sample_docx_file: Path):
        from app.services.document_parser import parse_docx
        pages = parse_docx(sample_docx_file)
        assert len(pages) >= 1
        combined = " ".join(text for _, text in pages)
        assert "machine learning" in combined.lower()

    def test_page_numbers_start_at_one(self, sample_docx_file: Path):
        from app.services.document_parser import parse_docx
        pages = parse_docx(sample_docx_file)
        assert pages[0][0] == 1


# ── parse_document dispatcher ─────────────────────────────────────────────────

class TestParseDocumentDispatcher:
    def test_dispatches_txt(self, sample_txt_file: Path):
        pages, total = parse_document(sample_txt_file)
        assert total == len(pages)
        assert total >= 1

    def test_dispatches_docx(self, sample_docx_file: Path):
        pages, total = parse_document(sample_docx_file)
        assert total >= 1

    def test_raises_on_unsupported_extension(self, tmp_path: Path):
        p = tmp_path / "file.csv"
        p.write_text("a,b,c")
        with pytest.raises(ValueError, match="Unsupported"):
            parse_document(p)
