"""
Document registry: persists DocumentMetadata records as a JSON file so
the app knows which documents are available without scanning the vector store.
"""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Dict, List, Optional

from loguru import logger

from app.models.document import DocumentMetadata


_REGISTRY_FILE = "document_registry.json"


class DocumentRegistry:
    def __init__(self, persist_dir: Path) -> None:
        self._path  = persist_dir / _REGISTRY_FILE
        self._lock  = threading.Lock()
        self._store: Dict[str, DocumentMetadata] = {}
        persist_dir.mkdir(parents=True, exist_ok=True)
        self._load()

    # ── Persistence ───────────────────────────────────────────────────────────

    def _load(self) -> None:
        if self._path.exists():
            try:
                raw = json.loads(self._path.read_text(encoding="utf-8"))
                self._store = {
                    doc_id: DocumentMetadata(**data)
                    for doc_id, data in raw.items()
                }
                logger.info(f"Registry loaded: {len(self._store)} documents")
            except Exception as exc:
                logger.warning(f"Registry load failed, starting fresh: {exc}")

    def _save(self) -> None:
        data = {
            doc_id: meta.model_dump(mode="json")
            for doc_id, meta in self._store.items()
        }
        self._path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")

    # ── Public API ────────────────────────────────────────────────────────────

    def add(self, meta: DocumentMetadata) -> None:
        with self._lock:
            self._store[meta.doc_id] = meta
            self._save()

    def get(self, doc_id: str) -> Optional[DocumentMetadata]:
        return self._store.get(doc_id)

    def list_all(self) -> List[DocumentMetadata]:
        return list(self._store.values())

    def delete(self, doc_id: str) -> bool:
        with self._lock:
            if doc_id not in self._store:
                return False
            del self._store[doc_id]
            self._save()
            return True

    def exists(self, doc_id: str) -> bool:
        return doc_id in self._store

    def find_by_filename(self, filename: str) -> Optional[DocumentMetadata]:
        for meta in self._store.values():
            if meta.filename == filename:
                return meta
        return None
