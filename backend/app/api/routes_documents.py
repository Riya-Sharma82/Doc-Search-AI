"""
Document management routes.

POST   /api/documents/upload        — upload one or more files
GET    /api/documents               — list all ingested documents
GET    /api/documents/{doc_id}      — get metadata for one document
DELETE /api/documents/{doc_id}      — delete a document from all stores
"""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from loguru import logger

from app.core.config import settings
from app.core.dependencies import get_ingestion_service, get_registry
from app.models.document import DeleteResponse, DocumentListItem, UploadResponse
from app.services.document_registry import DocumentRegistry
from app.services.ingestion import IngestionService
from app.utils.validators import validate_upload_file

router = APIRouter(prefix="/api/documents", tags=["documents"])


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post(
    "/upload",
    response_model=List[UploadResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload and ingest one or more documents",
)
async def upload_documents(
    files: List[UploadFile] = File(..., description="PDF, DOCX, or TXT files"),
    ingestion: IngestionService = Depends(get_ingestion_service),
) -> List[UploadResponse]:
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided.",
        )

    results: List[UploadResponse] = []

    for upload in files:
        # ── Validate ──────────────────────────────────────────────────────────
        try:
            validate_upload_file(upload)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            )

        # ── Save to disk ──────────────────────────────────────────────────────
        # Use a unique stem to avoid collisions while preserving the extension
        suffix = Path(upload.filename).suffix.lower()
        safe_name = f"{uuid.uuid4().hex}{suffix}"
        dest_path = settings.upload_path / safe_name

        try:
            with dest_path.open("wb") as fh:
                shutil.copyfileobj(upload.file, fh)
        except OSError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save '{upload.filename}': {exc}",
            )
        finally:
            await upload.close()

        # ── Ingest ────────────────────────────────────────────────────────────
        try:
            result = ingestion.ingest(
                file_path=dest_path,
                original_filename=upload.filename,
            )
            results.append(result)
            logger.info(f"Uploaded and ingested '{upload.filename}'")
        except Exception as exc:
            # Clean up the saved file if ingestion fails
            dest_path.unlink(missing_ok=True)
            logger.error(f"Ingestion failed for '{upload.filename}': {exc}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to process '{upload.filename}': {exc}",
            )

    return results


# ── List ──────────────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=List[DocumentListItem],
    summary="List all ingested documents",
)
async def list_documents(
    registry: DocumentRegistry = Depends(get_registry),
) -> List[DocumentListItem]:
    docs = registry.list_all()
    return [
        DocumentListItem(
            doc_id=d.doc_id,
            filename=d.filename,
            file_type=d.file_type,
            file_size_bytes=d.file_size_bytes,
            total_pages=d.total_pages,
            total_chunks=d.total_chunks,
            upload_time=d.upload_time,
        )
        for d in docs
    ]


# ── Get one ───────────────────────────────────────────────────────────────────

@router.get(
    "/{doc_id}",
    response_model=DocumentListItem,
    summary="Get metadata for a single document",
)
async def get_document(
    doc_id: str,
    registry: DocumentRegistry = Depends(get_registry),
) -> DocumentListItem:
    meta = registry.get(doc_id)
    if meta is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{doc_id}' not found.",
        )
    return DocumentListItem(
        doc_id=meta.doc_id,
        filename=meta.filename,
        file_type=meta.file_type,
        file_size_bytes=meta.file_size_bytes,
        total_pages=meta.total_pages,
        total_chunks=meta.total_chunks,
        upload_time=meta.upload_time,
    )


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete(
    "/{doc_id}",
    response_model=DeleteResponse,
    summary="Delete a document from all stores",
)
async def delete_document(
    doc_id: str,
    ingestion: IngestionService = Depends(get_ingestion_service),
    registry: DocumentRegistry = Depends(get_registry),
) -> DeleteResponse:
    meta = registry.get(doc_id)
    if meta is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{doc_id}' not found.",
        )

    deleted = ingestion.delete(doc_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Deletion failed unexpectedly.",
        )

    return DeleteResponse(
        doc_id=doc_id,
        message=f"Document '{meta.filename}' deleted successfully.",
    )
