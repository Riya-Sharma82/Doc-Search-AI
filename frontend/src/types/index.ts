// ── Document types ────────────────────────────────────────────────────────────

export interface DocumentListItem {
  doc_id: string
  filename: string
  file_type: string
  file_size_bytes: number
  total_pages: number
  total_chunks: number
  upload_time: string
}

export interface UploadResponse {
  doc_id: string
  filename: string
  total_chunks: number
  total_pages: number
  message: string
}

export interface DeleteResponse {
  doc_id: string
  message: string
}

// ── Search / QA types ─────────────────────────────────────────────────────────

export interface Citation {
  doc_id: string
  filename: string
  page_number: number
  chunk_index: number
  passage: string
  score: number
}

export interface SearchRequest {
  query: string
  top_k?: number
  hybrid_alpha?: number
  enable_reranker?: boolean
  conversation_history?: ConversationMessage[]
  doc_ids?: string[]
}

export interface SearchResponse {
  answer: string
  citations: Citation[]
  retrieved_passages: Citation[]
  query: string
  latency_ms: number
}

// ── Conversation ───────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: 'user' | 'model'
  parts: string[]
}

export interface ChatTurn {
  id: string
  query: string
  response: SearchResponse | null
  error: string | null
  loading: boolean
  timestamp: Date
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface SearchSettings {
  topK: number
  hybridAlpha: number
  enableReranker: boolean
  filterDocIds: string[]
}

// ── Health ────────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string
  documents_indexed: number
  vector_store_type: string
  embedding_model: string
}

// ── UI state ──────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark'
export type ActiveTab = 'search' | 'documents' | 'settings'
export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'
