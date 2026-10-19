import { useState } from 'react'
import {
  FileText,
  Trash2,
  RefreshCw,
  Search,
  BookOpen,
  Layers,
  AlertCircle,
  Upload,
  Database,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  HardDrive,
} from 'lucide-react'
import clsx from 'clsx'
import type { DocumentListItem } from '../types'
import { extractErrorMessage } from '../services/api'
import { formatBytes, formatDate, fileTypeColor } from '../utils/format'
import UploadZone from './UploadZone'

interface Props {
  documents: DocumentListItem[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onDelete: (docId: string) => Promise<void>
  upload: (files: File[], onProgress?: (pct: number) => void) => Promise<import('../types').UploadResponse[]>
  onAskAboutDoc?: (doc: DocumentListItem) => void
}

export default function DocumentsPanel({
  documents,
  loading,
  error,
  onRefresh,
  onDelete,
  upload,
  onAskAboutDoc,
}: Props) {
  const [searchFilter, setSearchFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'pdf' | 'docx' | 'txt'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(documents.length === 0)

  const filtered = documents.filter((d) => {
    const matchesSearch = d.filename.toLowerCase().includes(searchFilter.toLowerCase())
    const matchesType = typeFilter === 'all' || d.file_type.toLowerCase() === typeFilter
    return matchesSearch && matchesType
  })

  const handleDelete = async (docId: string) => {
    setDeletingId(docId)
    setDeleteError(null)
    setConfirmDeleteId(null)
    try {
      await onDelete(docId)
    } catch (err) {
      setDeleteError(extractErrorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  const totalChunks = documents.reduce((s, d) => s + d.total_chunks, 0)
  const totalSize = documents.reduce((s, d) => s + d.file_size_bytes, 0)
  const totalPages = documents.reduce((s, d) => s + (d.total_pages || 0), 0)

  return (
    <div className="space-y-6">
      {/* ── Knowledge Base Analytics Bar ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Indexed Documents',
            value: documents.length,
            sub: `${totalPages} total pages`,
            icon: FileText,
            color: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60',
          },
          {
            label: 'Indexed Chunks',
            value: totalChunks.toLocaleString(),
            sub: 'Vector + BM25 entries',
            icon: Layers,
            color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60',
          },
          {
            label: 'Corpus Size',
            value: formatBytes(totalSize),
            sub: 'Extracted text & tables',
            icon: HardDrive,
            color: 'text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-950/60',
          },
          {
            label: 'Search Engine',
            value: 'FAISS + RRF',
            sub: 'Reciprocal Rank Fusion',
            icon: Database,
            color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60',
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div
            key={label}
            className="glass-card p-4 transition-all duration-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {label}
              </span>
              <div className={clsx('flex h-7 w-7 items-center justify-center rounded-lg', color)}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
              {value}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              {sub}
            </p>
          </div>
        ))}
      </div>

      {/* ── Upload Box Section ── */}
      <div className="glass-card overflow-hidden">
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="flex w-full items-center justify-between p-4 text-left hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Upload New Documents
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Ingest PDF, DOCX, or TXT into FAISS and BM25 search indices
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400">
            <span>{showUpload ? 'Collapse' : 'Upload Files'}</span>
            {showUpload ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {showUpload && (
          <div className="border-t border-slate-100 p-5 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
            <UploadZone
              upload={upload}
              onUploadComplete={() => {
                onRefresh()
              }}
            />
          </div>
        )}
      </div>

      {/* ── Document Management & Search List ── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search filter input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by document name…"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="input pl-10 h-10"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Format filter pills */}
            <div className="flex items-center rounded-xl border border-slate-200/80 bg-slate-100/70 p-1 dark:border-slate-800 dark:bg-slate-900/80 text-xs">
              {(['all', 'pdf', 'docx', 'txt'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={clsx(
                    'rounded-lg px-2.5 py-1 font-semibold uppercase tracking-wider transition-all',
                    typeFilter === type
                      ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-400'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                  )}
                >
                  {type}
                </button>
              ))}
            </div>

            <button
              onClick={onRefresh}
              disabled={loading}
              className="btn-secondary h-10 px-3 shrink-0"
              title="Refresh document inventory"
            >
              <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Errors display */}
        {(error || deleteError) && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <span>{error || deleteError}</span>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && documents.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-2xl border border-slate-200/60 bg-slate-100/80 dark:border-slate-800/60 dark:bg-slate-800/80"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && documents.length === 0 && (
          <div className="glass-card py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 mb-3">
              <FileText className="h-7 w-7" />
            </div>
            <p className="text-base font-bold text-slate-800 dark:text-slate-200">
              No documents indexed yet
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
              Upload your reference papers, guidelines, or manuals above to unlock document-grounded AI search.
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="btn-gradient mt-4 text-xs py-2 px-4"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Document</span>
            </button>
          </div>
        )}

        {/* No filter match */}
        {!loading && documents.length > 0 && filtered.length === 0 && (
          <div className="glass-card py-10 text-center">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              No documents match your filter
            </p>
            <button
              onClick={() => {
                setSearchFilter('')
                setTypeFilter('all')
              }}
              className="mt-2 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
            >
              Reset filters
            </button>
          </div>
        )}

        {/* Document rows */}
        <div className="space-y-2.5">
          {filtered.map((doc) => (
            <DocumentRow
              key={doc.doc_id}
              doc={doc}
              isDeleting={deletingId === doc.doc_id}
              isConfirmingDelete={confirmDeleteId === doc.doc_id}
              onRequestDelete={() => setConfirmDeleteId(doc.doc_id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              onConfirmDelete={() => void handleDelete(doc.doc_id)}
              onAskAboutDoc={onAskAboutDoc}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Document Row Component ──────────────────────────────────────────────────

function DocumentRow({
  doc,
  isDeleting,
  isConfirmingDelete,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onAskAboutDoc,
}: {
  doc: DocumentListItem
  isDeleting: boolean
  isConfirmingDelete: boolean
  onRequestDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
  onAskAboutDoc?: (doc: DocumentListItem) => void
}) {
  const colorClass = fileTypeColor(doc.file_type)

  return (
    <div
      className={clsx(
        'glass-card p-4 transition-all duration-200',
        isDeleting && 'opacity-40 pointer-events-none',
        isConfirmingDelete
          ? 'border-rose-300 ring-2 ring-rose-500/20 dark:border-rose-800'
          : 'hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm',
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Document icon + details */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <FileText className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                {doc.filename}
              </span>
              <span className={clsx('badge uppercase text-[10px]', colorClass)}>
                {doc.file_type}
              </span>
              <span className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60">
                Indexed
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-400 dark:text-slate-500">
              <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                <BookOpen className="h-3 w-3 text-slate-400" />
                {doc.total_pages} page{doc.total_pages !== 1 ? 's' : ''}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3 w-3 text-slate-400" />
                {doc.total_chunks} chunks
              </span>
              <span>·</span>
              <span>{formatBytes(doc.file_size_bytes)}</span>
              <span>·</span>
              <span>{formatDate(doc.upload_time)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {/* Quick Ask */}
          {onAskAboutDoc && !isConfirmingDelete && (
            <button
              onClick={() => onAskAboutDoc(doc)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-all hover:bg-brand-100 hover:border-brand-300 dark:border-brand-900/60 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/40"
              title="Query specifically about this document"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Ask Doc</span>
            </button>
          )}

          {/* Delete with inline confirmation */}
          {isConfirmingDelete ? (
            <div className="flex items-center gap-1.5 animate-fade-in">
              <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold mr-1">
                Delete?
              </span>
              <button
                onClick={onConfirmDelete}
                className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition-colors"
              >
                Yes, Delete
              </button>
              <button
                onClick={onCancelDelete}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : isDeleting ? (
            <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
          ) : (
            <button
              onClick={onRequestDelete}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
              aria-label={`Delete ${doc.filename}`}
              title="Delete document"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
