"""
Application configuration loaded from environment variables.
"""
from pathlib import Path
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── LLM ──────────────────────────────────────
    gemini_api_key: str = Field(default="", description="Google Gemini API key")
    gemini_model: str = Field(default="gemini-1.5-flash")

    # ── Embeddings ────────────────────────────────
    embedding_model: str = Field(default="all-MiniLM-L6-v2")

    # ── Retrieval ────────────────────────────────
    vector_store_type: str = Field(default="faiss")  # faiss | chroma
    top_k_results: int = Field(default=10, ge=1, le=50)
    hybrid_alpha: float = Field(default=0.5, ge=0.0, le=1.0)
    enable_reranker: bool = Field(default=False)
    reranker_model: str = Field(default="cross-encoder/ms-marco-MiniLM-L-6-v2")

    # ── Chunking ──────────────────────────────────
    chunk_size: int = Field(default=512, ge=64, le=4096)
    chunk_overlap: int = Field(default=64, ge=0, le=512)

    # ── File limits ───────────────────────────────
    max_file_size_mb: int = Field(default=50, ge=1, le=500)
    allowed_extensions: str = Field(default="pdf,docx,txt")

    # ── Storage ───────────────────────────────────
    upload_dir: str = Field(default="data/uploads")
    vectorstore_dir: str = Field(default="data/vectorstore")

    # ── Server ────────────────────────────────────
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)
    cors_origins: str = Field(default="http://localhost:5173,http://localhost:3000")

    # ── Derived helpers ───────────────────────────
    @property
    def allowed_extensions_list(self) -> List[str]:
        return [ext.strip().lower() for ext in self.allowed_extensions.split(",")]

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024

    @property
    def upload_path(self) -> Path:
        p = Path(self.upload_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def vectorstore_path(self) -> Path:
        p = Path(self.vectorstore_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()
