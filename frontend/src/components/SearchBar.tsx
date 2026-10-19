import { useState, useRef, type KeyboardEvent, type FormEvent } from 'react'
import { Search, SendHorizontal, Loader2, X, FileText } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  onSearch: (query: string) => void
  isLoading: boolean
  placeholder?: string
  activeDocCount?: number
  selectedDocName?: string | null
  onClearFilter?: () => void
  hybridAlpha?: number
  enableReranker?: boolean
}

export default function SearchBar({
  onSearch,
  isLoading,
  placeholder,
  activeDocCount = 0,
  selectedDocName,
  onClearFilter,
  hybridAlpha = 0.5,
  enableReranker = false,
}: Props) {
  const [query, setQuery] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const trimmed = query.trim()
    if (!trimmed || isLoading) return
    onSearch(trimmed)
    setQuery('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit()
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      {/* Active scope chips bar */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedDocName ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-300 bg-brand-50/90 px-2.5 py-1 text-brand-700 dark:border-brand-800 dark:bg-brand-950/60 dark:text-brand-300">
              <FileText className="h-3 w-3 text-brand-500" />
              <span className="font-medium max-w-[200px] truncate">Scoped to: {selectedDocName}</span>
              {onClearFilter && (
                <button
                  type="button"
                  onClick={onClearFilter}
                  className="rounded-full p-0.5 hover:bg-brand-200 dark:hover:bg-brand-900"
                  title="Remove document filter"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-100/70 px-2.5 py-0.5 text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              <span>Scope:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {activeDocCount > 0 ? `All ${activeDocCount} Documents` : 'No documents indexed'}
              </span>
            </div>
          )}

          {/* Engine indicator pill */}
          <div className="hidden sm:inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            <span className="text-slate-400">Retrieval:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {hybridAlpha === 0.5 ? 'Hybrid RRF' : hybridAlpha > 0.5 ? `Semantic (α=${hybridAlpha})` : `BM25 (α=${hybridAlpha})`}
            </span>
            {enableReranker && (
              <span className="ml-1 rounded bg-amber-100 px-1 py-0.2 text-[9px] font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                Reranker ON
              </span>
            )}
          </div>
        </div>

        <div className="text-[11px] text-slate-400 dark:text-slate-500 hidden md:block">
          Press <kbd className="rounded border border-slate-200 bg-slate-100 px-1 py-0.2 font-mono text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">Enter ↵</kbd> to ask
        </div>
      </div>

      {/* Main Command Input Box */}
      <div
        className={clsx(
          'relative flex items-end gap-2.5 rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur-xl transition-all duration-200 dark:bg-slate-900/95',
          isLoading
            ? 'border-brand-500 ring-4 ring-brand-500/10 shadow-brand-500/5'
            : 'border-slate-200/90 hover:border-slate-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 shadow-slate-200/40 dark:border-slate-800 dark:hover:border-slate-700 dark:focus-within:border-brand-400 dark:shadow-black/20',
        )}
      >
        <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
          <Search className="h-4 w-4" />
        </div>

        <textarea
          ref={textareaRef}
          rows={1}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={
            placeholder ?? (activeDocCount === 0 ? 'Upload documents to begin searching...' : 'Ask any question grounded in your documents...')
          }
          disabled={isLoading}
          className="max-h-44 min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed text-slate-900 placeholder-slate-400 focus:outline-none disabled:opacity-50 dark:text-slate-100 dark:placeholder-slate-500"
          aria-label="Search query"
        />

        <div className="mb-0.5 flex shrink-0 items-center gap-1.5">
          {query && !isLoading && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                if (textareaRef.current) textareaRef.current.style.height = 'auto'
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              aria-label="Clear query"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className={clsx(
              'flex h-9 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-all duration-200',
              query.trim() && !isLoading
                ? 'bg-gradient-to-r from-brand-600 to-accent-600 text-white shadow-md shadow-brand-500/25 hover:shadow-lg hover:shadow-brand-500/35 hover:opacity-95 active:scale-95'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed',
            )}
            aria-label="Submit question"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">Searching...</span>
              </>
            ) : (
              <>
                <span>Ask AI</span>
                <SendHorizontal className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
