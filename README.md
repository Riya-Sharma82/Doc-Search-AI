# DocSearch AI — Document-Grounded Semantic Search

A production-ready, end-to-end AI search system. Upload PDF, DOCX, or TXT files and ask natural-language questions. Every answer is grounded strictly in the uploaded documents and includes clickable source citations.

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Quick Start (Local)](#quick-start-local)
5. [Quick Start (Docker)](#quick-start-docker)
6. [Environment Variables](#environment-variables)
7. [API Reference](#api-reference)
8. [Search Pipeline](#search-pipeline)
9. [Project Structure](#project-structure)
10. [Running Tests](#running-tests)
11. [Evaluation](#evaluation)
12. [Example Queries](#example-queries)
13. [Configuration Tuning](#configuration-tuning)

---

## Features

| Feature | Detail |
|---|---|
| Document upload | PDF (PyMuPDF), DOCX (python-docx), TXT — up to 50 MB each |
| Semantic search | Sentence Transformers (`all-MiniLM-L6-v2`) + FAISS flat index |
| Keyword search | BM25Okapi (rank-bm25) |
| Hybrid retrieval | Reciprocal Rank Fusion with configurable α weight |
| Reranking | Optional cross-encoder (`ms-marco-MiniLM-L-6-v2`) |
| Answer generation | Google Gemini 1.5 Flash — strictly grounded, no hallucination |
| Citations | Filename, page number, passage excerpt per answer |
| Conversation | Follow-up questions with rolling history window |
| Dark / light theme | System preference detected; persisted in localStorage |
| Docker | Multi-stage images + Compose with health checks |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (React)                      │
│  SearchPanel · DocumentsPanel · SettingsPanel · Navbar  │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP /api/*
┌───────────────────────▼─────────────────────────────────┐
│               FastAPI Backend (Python)                   │
│                                                          │
│  POST /api/documents/upload                              │
│    └─ DocumentParser → Chunker → Embedder                │
│         └─ FAISSVectorStore + BM25Store + Registry       │
│                                                          │
│  POST /api/search                                        │
│    └─ Embed query                                        │
│         ├─ FAISS semantic search  ─┐                     │
│         └─ BM25 keyword search    ─┴─ RRF fusion         │
│                                        └─ [reranker]     │
│                                             └─ Gemini    │
│                                                  └─ Answer + Citations
└─────────────────────────────────────────────────────────┘
```

### Key design decisions

- **No hallucination** — the system prompt forbids Gemini from using any knowledge outside the retrieved passages. A sentinel phrase is returned when evidence is insufficient.
- **FAISS flat inner-product index** — L2-normalised vectors → cosine similarity via dot product. No approximate search needed at document-collection scale; full precision.
- **RRF fusion** — avoids score normalisation across heterogeneous retrieval systems. α=1 collapses to semantic-only; α=0 to BM25-only.
- **Persistent stores** — FAISS index, BM25 corpus, and document registry are all serialised to `data/vectorstore/` so the server survives restarts without re-ingesting.
- **Singleton services** — all heavy objects (embedding model, FAISS index) are created once at startup via `@lru_cache` and injected with FastAPI `Depends`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS 3, Vite, Axios |
| Backend | Python 3.11, FastAPI, Uvicorn |
| Embeddings | `sentence-transformers` (`all-MiniLM-L6-v2`, 384-dim) |
| Vector DB | FAISS (`IndexFlatIP`) |
| Keyword search | `rank-bm25` (`BM25Okapi`) |
| Reranker | `cross-encoder/ms-marco-MiniLM-L-6-v2` (optional) |
| LLM | Google Gemini 1.5 Flash (`google-generativeai`) |
| PDF parsing | `PyMuPDF` (fitz) |
| DOCX parsing | `python-docx` |
| Testing | `pytest`, `pytest-cov`, `httpx` |
| Containers | Docker (multi-stage), Docker Compose |

---

## Quick Start (Local)

### Prerequisites

- Python 3.11+
- Node.js 20+
- A Google Gemini API key — get one free at <https://aistudio.google.com>

### 1. Clone and configure

```bash
git clone <repo-url> "DocSearch AI"
cd "DocSearch AI"
cp .env.example .env
# Open .env and set GEMINI_API_KEY=your_key_here
```

### 2. Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Install dependencies (first run downloads ~800 MB of models)
pip install -r requirements.txt

# Start the API server
uvicorn app.main:app --reload --port 8000
```

The API is now available at <http://localhost:8000>.  
Interactive docs: <http://localhost:8000/docs>

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173> in your browser.

> The Vite dev server proxies all `/api/*` requests to `http://localhost:8000` automatically.

---

## Quick Start (Docker)

```bash
cp .env.example .env
# Set GEMINI_API_KEY in .env

# Build images and start both services
docker compose up --build

# Or run detached
docker compose up --build -d
```

| Service | URL |
|---|---|
| Frontend (nginx) | <http://localhost> |
| Backend API | <http://localhost:8000> |
| API docs | <http://localhost:8000/docs> |

**First start** downloads the embedding model (~90 MB) and takes ~60–90 s.  
Subsequent starts are fast — the model is cached in the `huggingface_cache` Docker volume.

```bash
# Stop
docker compose down

# Stop and remove all data volumes
docker compose down -v
```

---

## Environment Variables

Copy `.env.example` to `.env` in the project root. All variables are optional except `GEMINI_API_KEY`.

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | _(required)_ | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Gemini model name |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Sentence Transformers model |
| `VECTOR_STORE_TYPE` | `faiss` | `faiss` (only option currently) |
| `TOP_K_RESULTS` | `10` | Default top-k retrieval |
| `HYBRID_ALPHA` | `0.5` | Default α (0=BM25, 1=semantic) |
| `ENABLE_RERANKER` | `false` | Load cross-encoder at startup |
| `RERANKER_MODEL` | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Cross-encoder model |
| `CHUNK_SIZE` | `512` | Characters per chunk |
| `CHUNK_OVERLAP` | `64` | Overlap between chunks |
| `MAX_FILE_SIZE_MB` | `50` | Max upload size |
| `ALLOWED_EXTENSIONS` | `pdf,docx,txt` | Accepted file types |
| `UPLOAD_DIR` | `data/uploads` | Saved upload files |
| `VECTORSTORE_DIR` | `data/vectorstore` | Persisted index files |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Allowed CORS origins |

---

## API Reference

### Health

```
GET /api/health
```
Returns system status, document count, vector store type, and embedding model.

### Documents

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/documents/upload` | Upload one or more files (`multipart/form-data`, field `files`) |
| `GET` | `/api/documents` | List all ingested documents |
| `GET` | `/api/documents/{doc_id}` | Get metadata for one document |
| `DELETE` | `/api/documents/{doc_id}` | Delete document from all stores |

**Upload example**
```bash
curl -X POST http://localhost:8000/api/documents/upload \
  -F "files=@report.pdf" \
  -F "files=@notes.txt"
```

**Response**
```json
[
  {
    "doc_id": "3f7a…",
    "filename": "report.pdf",
    "total_chunks": 42,
    "total_pages": 8,
    "message": "Document processed successfully"
  }
]
```

### Search

```
POST /api/search
Content-Type: application/json
```

**Request body**
```json
{
  "query": "What are the main risk factors identified?",
  "top_k": 5,
  "hybrid_alpha": 0.5,
  "enable_reranker": false,
  "conversation_history": [],
  "doc_ids": null
}
```

**Response**
```json
{
  "answer": "The report identifies three main risk factors… [Doc: report.pdf, Page 3]",
  "citations": [
    {
      "doc_id": "3f7a…",
      "filename": "report.pdf",
      "page_number": 3,
      "chunk_index": 14,
      "passage": "The primary risk factors are…",
      "score": 0.8821
    }
  ],
  "retrieved_passages": [...],
  "query": "What are the main risk factors identified?",
  "latency_ms": 1240.5
}
```

**GET convenience endpoint** (for quick testing)
```
GET /api/search?q=What+is+the+conclusion&top_k=3
```

---

## Search Pipeline

```
User query
    │
    ▼
1. Embed query          (SentenceTransformer, L2-normalised)
    │
    ├──────────────────────────────────────┐
    ▼                                      ▼
2a. FAISS semantic search            2b. BM25 keyword search
    (top 4×k candidates)                  (top 4×k candidates)
    │                                      │
    └──────────────┬───────────────────────┘
                   ▼
3. Reciprocal Rank Fusion
   score = α × semantic_rrf + (1-α) × bm25_rrf
                   │
                   ▼
4. [Optional] Cross-encoder reranking
                   │
                   ▼
5. Top-k Citation objects
                   │
                   ▼
6. Gemini prompt construction
   (system prompt + numbered passages + question)
                   │
                   ▼
7. Grounded answer + inline citations
```

---

## Project Structure

```
DocSearch AI/
├── .env.example
├── .dockerignore
├── docker-compose.yml
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── run.py
│   ├── app/
│   │   ├── main.py                   # FastAPI app factory + lifespan
│   │   ├── api/
│   │   │   ├── routes_documents.py   # Upload / list / delete
│   │   │   ├── routes_search.py      # POST & GET /search
│   │   │   └── routes_health.py      # /health
│   │   ├── core/
│   │   │   ├── config.py             # Pydantic settings
│   │   │   ├── dependencies.py       # DI container (lru_cache singletons)
│   │   │   └── logging.py            # Loguru setup
│   │   ├── models/
│   │   │   └── document.py           # Pydantic request/response models
│   │   ├── services/
│   │   │   ├── document_parser.py    # PDF / DOCX / TXT extraction
│   │   │   ├── chunker.py            # Overlapping text chunking
│   │   │   ├── embedder.py           # SentenceTransformer wrapper
│   │   │   ├── vector_store.py       # FAISS store (persistent)
│   │   │   ├── bm25_store.py         # BM25 store (persistent)
│   │   │   ├── document_registry.py  # JSON metadata store
│   │   │   ├── retriever.py          # Hybrid retrieval + RRF + reranker
│   │   │   ├── ingestion.py          # Upload pipeline orchestrator
│   │   │   └── llm.py                # Gemini client + AnswerService
│   │   └── utils/
│   │       └── validators.py         # File upload validation
│   ├── tests/
│   │   ├── conftest.py               # Fixtures + TestClient setup
│   │   ├── test_document_parser.py
│   │   ├── test_chunker.py
│   │   ├── test_retrieval.py
│   │   ├── test_llm.py
│   │   └── test_api.py
│   └── data/
│       ├── uploads/                  # Saved upload files
│       └── vectorstore/              # FAISS + BM25 + registry files
│
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── types/index.ts
│       ├── services/api.ts
│       ├── utils/format.ts
│       ├── hooks/
│       │   ├── useTheme.ts
│       │   ├── useDocuments.ts
│       │   └── useSearch.ts
│       └── components/
│           ├── Navbar.tsx
│           ├── SearchBar.tsx
│           ├── SearchPanel.tsx
│           ├── ChatTurnView.tsx
│           ├── AnswerCard.tsx
│           ├── CitationCard.tsx
│           ├── UploadZone.tsx
│           ├── DocumentsPanel.tsx
│           └── SettingsPanel.tsx
│
├── evaluation/
│   ├── eval_dataset.json             # Q&A ground-truth pairs
│   └── run_eval.py                   # Recall@K, MRR, latency benchmark
│
└── sample_docs/
    ├── ai_overview.txt
    └── ml_concepts.txt
```

---

## Running Tests

```bash
cd backend
source .venv/bin/activate

# Run all tests with coverage
pytest

# Run only fast unit tests (skip integration)
pytest -m "not integration"

# Run a specific test file
pytest tests/test_retrieval.py -v

# Coverage report (opens htmlcov/index.html)
pytest --cov=app --cov-report=html
open htmlcov/index.html
```

Tests use a `StubEmbedder` that produces deterministic random vectors without loading a real model, so the full suite runs in seconds without a GPU.

---

## Evaluation

The `evaluation/` directory contains:

- `eval_dataset.json` — 10 question/answer pairs with expected source documents
- `run_eval.py` — measures Recall@K, Precision@K, MRR, answer faithfulness, and latency

```bash
cd backend
source .venv/bin/activate

# Make sure the backend is running (in another terminal):
# uvicorn app.main:app --port 8000

# Upload sample docs first, then run:
python ../evaluation/run_eval.py \
  --dataset ../evaluation/eval_dataset.json \
  --api-url http://localhost:8000 \
  --top-k 5 \
  --alpha 0.5
```

The script compares keyword-only (α=0), semantic-only (α=1), and hybrid (α=0.5) modes and prints a comparison table.

---

## Example Queries

After uploading the sample documents in `sample_docs/`:

| Query | Expected behaviour |
|---|---|
| `What is machine learning?` | Answer citing `ai_overview.txt` |
| `How does deep learning differ from machine learning?` | Multi-passage answer with page citations |
| `What is gradient descent?` | Specific algorithmic explanation |
| `What is the capital of France?` | Sentinel: "I couldn't find sufficient information…" |
| `Summarise all documents` | High-level summary grounded in uploaded content |

---

## Configuration Tuning

| Goal | Setting |
|---|---|
| Faster responses, lower accuracy | Reduce `TOP_K_RESULTS` to 3–5 |
| Better accuracy for long documents | Increase `CHUNK_SIZE` to 1024, `CHUNK_OVERLAP` to 128 |
| Improve ranking precision | Set `ENABLE_RERANKER=true` (adds ~500 ms) |
| Keyword-heavy technical docs | Lower `HYBRID_ALPHA` to 0.2–0.3 |
| Conceptual / semantic queries | Raise `HYBRID_ALPHA` to 0.7–0.9 |
| Larger embedding model | Set `EMBEDDING_MODEL=all-mpnet-base-v2` (slower, more accurate) |
