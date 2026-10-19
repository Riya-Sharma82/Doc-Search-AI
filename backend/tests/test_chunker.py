"""Tests for the text chunker."""
from __future__ import annotations

from app.services.chunker import _split_page_into_chunks, chunk_document
from app.services.document_parser import PageText


class TestSplitPageIntoChunks:
    def test_short_text_produces_one_chunk(self):
        text = "Short sentence."
        chunks = _split_page_into_chunks(text, chunk_size=512, chunk_overlap=64)
        assert len(chunks) == 1
        assert chunks[0][0] == text.strip()

    def test_long_text_produces_multiple_chunks(self):
        text = "word " * 300          # ~1 500 chars
        chunks = _split_page_into_chunks(text, chunk_size=200, chunk_overlap=20)
        assert len(chunks) > 1

    def test_chunks_overlap(self):
        text = "alpha beta gamma delta epsilon zeta eta theta iota kappa " * 20
        chunks = _split_page_into_chunks(text, chunk_size=100, chunk_overlap=30)
        # The end of chunk N and the start of chunk N+1 should share content
        if len(chunks) >= 2:
            end_of_first = chunks[0][0][-20:]
            start_of_second = chunks[1][0][:50]
            # They overlap somewhere — at least one word from the end of chunk 0
            # should appear near the start of chunk 1
            words_end = set(end_of_first.split())
            words_start = set(start_of_second.split())
            assert words_end & words_start, "No overlap detected between consecutive chunks"

    def test_offsets_are_valid(self):
        text = "Hello world this is a test sentence for offset checking purposes."
        chunks = _split_page_into_chunks(text, chunk_size=20, chunk_overlap=5)
        for _, start, end in chunks:
            assert 0 <= start < len(text)
            assert end <= len(text)
            assert start < end

    def test_empty_text_returns_empty(self):
        assert _split_page_into_chunks("", 512, 64) == []

    def test_invalid_chunk_size_raises(self):
        import pytest
        with pytest.raises(ValueError):
            _split_page_into_chunks("text", chunk_size=0, chunk_overlap=0)


class TestChunkDocument:
    def test_returns_document_chunks(self, sample_txt_file):
        from app.services.document_parser import parse_txt
        pages = parse_txt(sample_txt_file)
        chunks = chunk_document(
            pages=pages,
            doc_id="doc-001",
            filename="sample.txt",
            chunk_size=200,
            chunk_overlap=20,
        )
        assert len(chunks) >= 1
        for chunk in chunks:
            assert chunk.doc_id == "doc-001"
            assert chunk.filename == "sample.txt"
            assert chunk.page_number >= 1
            assert len(chunk.text) > 0

    def test_chunk_indices_are_sequential(self, sample_txt_file):
        from app.services.document_parser import parse_txt
        pages = parse_txt(sample_txt_file)
        chunks = chunk_document(pages, "doc-x", "f.txt", 150, 15)
        for i, chunk in enumerate(chunks):
            assert chunk.chunk_index == i

    def test_empty_pages_returns_empty(self):
        chunks = chunk_document([], "doc-y", "empty.txt")
        assert chunks == []
