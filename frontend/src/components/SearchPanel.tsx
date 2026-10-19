import { useEffect, useRef, useState } from 'react'
import {
  Trash2,
  Sparkles,
  BookOpen,
  Compass,
  FileCheck2,
  FileText,
  Filter,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import clsx from 'clsx'
import type { DocumentListItem, SearchSettings } from '../types'
import { useSearch } from '../hooks/useSearch'
import SearchBar from './SearchBar'
import ChatTurnView from './ChatTurnView'

interface Props {
  settings: SearchSettings
  documentCount: number
  documents?: DocumentListItem[]
  onOpenUpload?: () => void
}

const STARTER_PROMPTS = [
  {
    category: 'Overview',
    icon: Compass,
    query: 'What is the main topic and purpose of these documents?',
    color: 'from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    category: 'Synthesis',
    icon: Sparkles,
    query: 'Summarise the key concepts and major findings into bullet points.',
    color: 'from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400',
  },
  {
    category: 'Practical Takeaways',
    icon: FileCheck2,
    query: 'What practical recommendations or actionable advice are outlined?',
    color: 'from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    category: 'Deep Dive',
    icon: BookOpen,
    query: 'What methodologies, challenges, or architectural details are described?',
    color: 'from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400',
  },
]

export default function SearchPanel({
  settings,
  documentCount,
  documents = [],
  onOpenUpload,
}: Props) {
  const { turns, isSearching, ask, clearHistory } = useSearch()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [selectedFilterDocId, setSelectedFilterDocId] = useState<string | null>(
    settings.filterDocIds.length === 1 ? settings.filterDocIds[0] : null,
  )

  // Auto-scroll to latest turn
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns])

  const handleSearch = (query: string) => {
    const activeSettings: SearchSettings = {
      ...settings,
      filterDocIds: selectedFilterDocId ? [selectedFilterDocId] : settings.filterDocIds,
    }
    void ask(query, activeSettings)
  }

  const selectedDocObj = documents.find((d) => d.doc_id === selectedFilterDocId)

  return (
    <div className="flex h-full flex-col justify-between gap-4">
      {/* ── Empty State / Hero Screen ── */}
      {turns.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center py-6 px-2 text-center animate-fade-in">
          {/* Top Pill */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-brand-50/80 px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm backdrop-blur-md dark:border-brand-900/60 dark:bg-brand-950/40 dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5 text-brand-500 animate-pulse-slow" />
            <span>Hybrid RAG · Semantic + BM25 Retrieval</span>
          </div>

          {/* Hero Title */}
          <h1 className="max-w-2xl text-2xl font-extrabold tracking-tight sm:text-4xl text-slate-900 dark:text-white">
            Search your knowledge base with{' '}
            <span className="gradient-text">grounded AI precision</span>
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {documentCount > 0 ? (
              <span>
                Ask natural-language questions across your{' '}
                <strong className="text-slate-700 dark:text-slate-200 font-semibold">
                  {documentCount} indexed document{documentCount > 1 ? 's' : ''}
                </strong>
                . Every answer includes verifiable source citations and page numbers.
              </span>
            ) : (
              <span>
                Upload PDF, DOCX, or TXT documents to build your vector knowledge base, then search with zero hallucination.
              </span>
            )}
          </p>

          {/* Quick Document Scope Pills (if documents exist) */}
          {documents.length > 0 && (
            <div className="mt-5 w-full max-w-xl">
              <div className="flex items-center justify-center gap-1.5 mb-2 text-xs font-medium text-slate-400">
                <Filter className="h-3 w-3" />
                <span>Scope query to:</span>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFilterDocId(null)}
                  className={clsx(
                    'rounded-full px-3 py-1 text-xs font-medium transition-all',
                    selectedFilterDocId === null
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400',
                  )}
                >
                  All Documents ({documents.length})
                </button>
                {documents.map((doc) => (
                  <button
                    key={doc.doc_id}
                    type="button"
                    onClick={() =>
                      setSelectedFilterDocId(selectedFilterDocId === doc.doc_id ? null : doc.doc_id)
                    }
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all max-w-[220px]',
                      selectedFilterDocId === doc.doc_id
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-brand-700',
                    )}
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{doc.filename}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Starter Prompts Grid */}
          {documentCount > 0 ? (
            <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2 text-left">
              {STARTER_PROMPTS.map((p) => {
                const Icon = p.icon
                return (
                  <button
                    key={p.category}
                    onClick={() => handleSearch(p.query)}
                    disabled={isSearching}
                    className="group relative flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white/70 p-3.5 shadow-sm backdrop-blur-md transition-all duration-200 hover:border-brand-400/50 hover:bg-white hover:shadow-md hover:-translate-y-0.5 dark:border-slate-800/80 dark:bg-slate-900/60 dark:hover:border-brand-700 dark:hover:bg-slate-900"
                  >
                    <div
                      className={clsx(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br',
                        p.color,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          {p.category}
                        </span>
                        <ArrowRight className="h-3 w-3 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-brand-500" />
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-slate-700 group-hover:text-brand-600 dark:text-slate-300 dark:group-hover:text-brand-400 leading-snug">
                        {p.query}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center">
              {onOpenUpload && (
                <button
                  onClick={onOpenUpload}
                  className="btn-gradient"
                >
                  <Zap className="h-4 w-4" />
                  <span>Upload Your First Document</span>
                </button>
              )}
            </div>
          )}

          {/* Engine Highlights */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 dark:text-slate-500">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Strict Grounding (No LLM hallucinations)
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Sub-second FAISS vector index
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5 text-brand-500" />
              Page-accurate citations
            </span>
          </div>
        </div>
      )}

      {/* ── Active Conversation History ── */}
      {turns.length > 0 && (
        <div className="flex flex-1 flex-col min-h-0">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 dark:border-slate-800/80 px-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span className="flex h-2 w-2 rounded-full bg-brand-500" />
              <span>
                {turns.length} exchange{turns.length > 1 ? 's' : ''} in session
              </span>
              {selectedDocObj && (
                <span className="rounded-md bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  Filter: {selectedDocObj.filename}
                </span>
              )}
            </div>

            <button
              onClick={clearHistory}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
              disabled={isSearching}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear chat</span>
            </button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto py-4 pr-1">
            {turns.map((turn, i) => (
              <ChatTurnView key={turn.id} turn={turn} index={i + 1} />
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {/* ── Bottom Command Search Bar ── */}
      <div className="pt-2 sticky bottom-0 z-20">
        <SearchBar
          onSearch={handleSearch}
          isLoading={isSearching}
          activeDocCount={documentCount}
          selectedDocName={selectedDocObj?.filename ?? null}
          onClearFilter={() => setSelectedFilterDocId(null)}
          hybridAlpha={settings.hybridAlpha}
          enableReranker={settings.enableReranker}
          placeholder={
            documentCount === 0
              ? 'Please upload documents in the Documents tab first...'
              : selectedDocObj
              ? `Ask about "${selectedDocObj.filename}"...`
              : 'Ask a question across your documents...'
          }
        />
      </div>
    </div>
  )
}
