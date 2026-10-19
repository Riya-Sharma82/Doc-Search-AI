import { useState } from 'react'
import { ChevronDown, ChevronUp, BookOpen, Copy, Check } from 'lucide-react'
import clsx from 'clsx'
import type { Citation } from '../types'
import { fileTypeColor } from '../utils/format'

interface Props {
  citation: Citation
  index: number
  defaultExpanded?: boolean
}

export default function CitationCard({ citation, index, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [copied, setCopied] = useState(false)

  const ext = citation.filename.split('.').pop()?.toLowerCase() ?? 'txt'
  const colorClass = fileTypeColor(ext)
  const scorePercent = Math.round(citation.score * 100)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(citation.passage)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={clsx(
        'group rounded-xl border bg-white/70 backdrop-blur-md transition-all duration-200 dark:bg-slate-900/60',
        expanded
          ? 'border-brand-300 shadow-md ring-1 ring-brand-400/20 dark:border-brand-700/60'
          : 'border-slate-200/80 hover:border-slate-300 hover:shadow-sm dark:border-slate-800/80 dark:hover:border-slate-700',
      )}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 p-3.5 text-left focus:outline-none"
        aria-expanded={expanded}
      >
        {/* Citation number pill */}
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-600 text-xs font-bold text-white shadow-sm shadow-brand-500/20">
          {index}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
              {citation.filename}
            </span>
            <span className={clsx('badge uppercase text-[10px]', colorClass)}>
              {ext}
            </span>
            <span className="badge border border-slate-200/80 bg-slate-100/80 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <BookOpen className="h-3 w-3 mr-0.5 text-slate-400" />
              Page {citation.page_number}
            </span>
            {citation.score > 0 && (
              <span className="badge border border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900 dark:bg-brand-950/60 dark:text-brand-300">
                {scorePercent}% match
              </span>
            )}
          </div>

          {!expanded && (
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">
              "{citation.passage}"
            </p>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-1.5 text-slate-400 transition-colors group-hover:text-slate-600 dark:group-hover:text-slate-200">
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Expanded passage */}
      {expanded && (
        <div className="animate-fade-in border-t border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800/80 dark:bg-slate-800/50 rounded-b-xl">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/50 dark:border-slate-800/50">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Document Excerpt · Chunk #{citation.chunk_index}
            </span>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy Excerpt</span>
                </>
              )}
            </button>
          </div>
          <p className="font-mono text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap selection:bg-brand-200 dark:selection:bg-brand-900">
            {citation.passage}
          </p>
        </div>
      )}
    </div>
  )
}
