"""
Document parser: extracts text + page metadata from PDF, DOCX, and TXT files.

Each parser returns a list of (page_number, text) tuples so the chunker
can preserve page provenance.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import List, Tuple

from loguru import logger


# ── Type alias ────────────────────────────────────────────────────────────────
PageText = List[Tuple[int, str]]   # [(page_number, text), ...]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clean_text(text: str) -> str:
    """Normalise whitespace and remove control characters."""
    # Replace various unicode spaces / zero-width chars
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", text)
    # Collapse multiple blank lines to at most two
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Collapse horizontal whitespace runs inside lines
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


# ── PDF ───────────────────────────────────────────────────────────────────────

def parse_pdf(file_path: Path) -> PageText:
    """Extract text per page from a PDF using PyMuPDF (fitz)."""
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:
        raise RuntimeError("PyMuPDF is not installed. Run: pip install pymupdf") from exc

    pages: PageText = []
    doc = fitz.open(str(file_path))
    try:
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")  # plain text extraction
            cleaned = _clean_text(text)
            if cleaned:
                pages.append((page_num + 1, cleaned))   # 1-indexed
    finally:
        doc.close()

    logger.debug(f"PDF '{file_path.name}': extracted {len(pages)} pages with text")
    return pages


# ── DOCX ──────────────────────────────────────────────────────────────────────

def parse_docx(file_path: Path) -> PageText:
    """
    Extract text from a DOCX file.

    DOCX files do not have reliable page boundaries, so we group paragraphs
    into synthetic 'pages' of roughly PAGE_PARA_LIMIT paragraphs each.
    """
    try:
        from docx import Document
    except ImportError as exc:
        raise RuntimeError("python-docx is not installed. Run: pip install python-docx") from exc

    PAGE_PARA_LIMIT = 30   # paragraphs per synthetic page

    doc = Document(str(file_path))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]

    # Also pull text from tables
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                cell_text = cell.text.strip()
                if cell_text:
                    paragraphs.append(cell_text)

    pages: PageText = []
    for i in range(0, max(len(paragraphs), 1), PAGE_PARA_LIMIT):
        chunk_text = "\n".join(paragraphs[i : i + PAGE_PARA_LIMIT])
        cleaned = _clean_text(chunk_text)
        if cleaned:
            pages.append((len(pages) + 1, cleaned))

    logger.debug(f"DOCX '{file_path.name}': extracted {len(pages)} synthetic pages")
    return pages


# ── TXT ───────────────────────────────────────────────────────────────────────

def parse_txt(file_path: Path) -> PageText:
    """
    Read a plain-text file and split into synthetic pages of ~3 000 characters.
    """
    PAGE_CHAR_LIMIT = 3_000

    text = file_path.read_text(encoding="utf-8", errors="replace")
    text = _clean_text(text)

    pages: PageText = []
    for i in range(0, max(len(text), 1), PAGE_CHAR_LIMIT):
        segment = text[i : i + PAGE_CHAR_LIMIT].strip()
        if segment:
            pages.append((len(pages) + 1, segment))

    logger.debug(f"TXT '{file_path.name}': split into {len(pages)} synthetic pages")
    return pages


# ── Dispatcher ────────────────────────────────────────────────────────────────

def parse_document(file_path: Path) -> Tuple[PageText, int]:
    """
    Dispatch to the correct parser based on file extension.

    Returns:
        (pages, total_pages)
    """
    ext = file_path.suffix.lower().lstrip(".")
    parsers = {
        "pdf":  parse_pdf,
        "docx": parse_docx,
        "txt":  parse_txt,
    }

    if ext not in parsers:
        raise ValueError(f"Unsupported file type: .{ext}. Allowed: pdf, docx, txt")

    pages = parsers[ext](file_path)
    return pages, len(pages)
