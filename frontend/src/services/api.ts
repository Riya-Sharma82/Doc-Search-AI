import axios, { AxiosError } from 'axios'
import type {
  DeleteResponse,
  DocumentListItem,
  HealthResponse,
  SearchRequest,
  SearchResponse,
  UploadResponse,
} from '../types'

const BASE_URL = '/api'

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 120_000,   // 2 min — LLM calls can be slow
})

// ── Error normaliser ──────────────────────────────────────────────────────────

function extractErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return detail.map((d) => d.msg).join('; ')
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'An unexpected error occurred.'
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await client.get<HealthResponse>('/health')
  return data
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function fetchDocuments(): Promise<DocumentListItem[]> {
  const { data } = await client.get<DocumentListItem[]>('/documents')
  return data
}

export async function uploadDocuments(
  files: File[],
  onProgress?: (pct: number) => void,
): Promise<UploadResponse[]> {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))

  const { data } = await client.post<UploadResponse[]>('/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100))
      }
    },
  })
  return data
}

export async function deleteDocument(docId: string): Promise<DeleteResponse> {
  const { data } = await client.delete<DeleteResponse>(`/documents/${docId}`)
  return data
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function search(req: SearchRequest): Promise<SearchResponse> {
  const { data } = await client.post<SearchResponse>('/search', req)
  return data
}

// Re-export error helper for use in components
export { extractErrorMessage }
