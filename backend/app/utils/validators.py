"""
Input validation helpers for uploaded files.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings


# MIME types we accept (belt-and-suspenders alongside extension check)
_ALLOWED_MIME_PREFIXES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "text/",
}


def validate_upload_file(file: UploadFile) -> None:
    """
    Validate file extension, MIME type, and size.

    Raises ValueError with a user-friendly message on any violation.
    """
    filename = file.filename or ""
    ext = Path(filename).suffix.lower().lstrip(".")

    # ── Extension check ───────────────────────────────────────────────────────
    if ext not in settings.allowed_extensions_list:
        raise ValueError(
            f"File type '.{ext}' is not supported. "
            f"Allowed: {', '.join(settings.allowed_extensions_list)}"
        )

    # ── MIME type check (best-effort; content_type may be None) ───────────────
    content_type = (file.content_type or "").lower()
    if content_type and not any(
        content_type.startswith(prefix) for prefix in _ALLOWED_MIME_PREFIXES
    ):
        raise ValueError(
            f"MIME type '{content_type}' is not accepted for file '{filename}'."
        )

    # ── Size check (file.size is set by python-multipart when available) ──────
    if file.size and file.size > settings.max_file_size_bytes:
        mb = file.size / (1024 * 1024)
        raise ValueError(
            f"File '{filename}' is {mb:.1f} MB, which exceeds the "
            f"{settings.max_file_size_mb} MB limit."
        )
