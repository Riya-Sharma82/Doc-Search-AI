"""
Text chunker: splits page text into overlapping chunks while preserving
page numbers and character offsets so citations are precise.
"""
from __future__ import annotations

from typing import List, Tuple

from loguru import logger

from app.models.document import DocumentChunk
from app.services.document_parser import PageText


def _split_page_into_chunks(
    text: str,
    chunk_size: int,
    chunk_overlap: int,
) -> List[Tuple[str, int, int]]:
    """
    Split *text* into overlapping chunks by character count.

    Returns a list of (chunk_text, char_start, char_end).
    Splitting happens at word boundaries when possible.
    """
    if chunk_size <= 0:
        raise ValueError("chunk_size must be > 0")
    if chunk_overlap < 0 or chunk_overlap >= chunk_size:
        chunk_overlap = max(0, chunk_size // 8)

    results: List[Tuple[str, int, int]] = []
    step = chunk_size - chunk_overlap
    start = 0

    while start < len(text):
        end = start + chunk_size

        if end < len(text):
            # Try to break at the nearest whitespace before end
            boundary = text.rfind(" ", start, end)
            if boundary > start + chunk_overlap:
                end = boundary

        segment = text[start:end].strip()
        if segment:
            results.append((segment, start, min(end, len(text))))

        start += step
        if start >= len(text):
            break

    return results


def chunk_document(
    pages: PageText,
    doc_id: str,
    filename: str,
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> List[DocumentChunk]:
    """
    Convert a list of (page_number, text) tuples into DocumentChunk objects.

    Each chunk tracks:
      - which page it came from
      - its position within the document (chunk_index)
      - char offsets within the page text
    """
    chunks: List[DocumentChunk] = []
    chunk_index = 0

    for page_number, page_text in pages:
        page_chunks = _split_page_into_chunks(page_text, chunk_size, chunk_overlap)

        for text, char_start, char_end in page_chunks:
            chunks.append(
                DocumentChunk(
                    doc_id=doc_id,
                    filename=filename,
                    page_number=page_number,
                    chunk_index=chunk_index,
                    text=text,
                    char_start=char_start,
                    char_end=char_end,
                )
            )
            chunk_index += 1

    logger.debug(
        f"Chunked '{filename}' → {len(chunks)} chunks "
        f"(size={chunk_size}, overlap={chunk_overlap})"
    )
    return chunks
