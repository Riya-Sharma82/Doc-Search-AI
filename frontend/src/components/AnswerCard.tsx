import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  BookMarked,
  Layers,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Download,
  ThumbsUp,
  ThumbsDown,
  FileCheck,
} from 'lucide-react'
import clsx from 'clsx'
import type { SearchResponse } from '../types'
import { formatLatency } from '../utils/format'
import CitationCard from './CitationCard'

const NO_ANSWER_PHRASE = "I couldn't find sufficient information"

interface Props {
  response: SearchResponse
  turnNumber: number
}

export default function AnswerCard({ response, turnNumber }: Props) {
  const [showAllPassages, setShowAllPassages] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)

  const isNoAnswer = response.answer.startsWith(NO_ANSWER_PHRASE)
  const hiddenPassages = response.retrieved_passages.slice(response.citations.length)

  // Speech synthesis stop on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(response.answer)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(response.answer)
    utterance.rate = 1.0
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  const handleExport = () => {
    const content = `# Query: ${response.query}\n\n## Answer\n${response.answer}\n\n## Sources\n${response.citations
      .map(
        (c, i) =>
          `[${i + 1}] ${c.filename} (Page ${c.page_number}, Match: ${Math.round(c.score * 100)}%)\n> ${c.passage}\n`,
      )
      .join('\n')}`

    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `docsearch-answer-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="animate-slide-up space-y-4">
      {/* ── Main Answer Card ── */}
      <div
        className={clsx(
          'relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-200',
          isNoAnswer
            ? 'border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20'
            : 'border-slate-200/90 bg-white/90 shadow-slate-200/30 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/80 dark:shadow-none',
        )}
      >
        {/* Subtle top gradient accent line */}
        {!isNoAnswer && (
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-brand-500 via-indigo-500 to-accent-500" />
        )}

        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div
              className={clsx(
                'flex h-8 w-8 items-center justify-center rounded-xl shadow-sm',
                isNoAnswer
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                  : 'bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-brand-500/20',
              )}
            >
              {isNoAnswer ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {isNoAnswer ? 'Uncertain Answer' : 'DocSearch Synthesis'}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  Turn #{turnNumber}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Strictly grounded · No external speculation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-1 rounded-full bg-slate-100/80 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800/80 dark:text-slate-400">
              <Clock className="h-3 w-3 text-slate-400" />
              <span>{formatLatency(response.latency_ms)}</span>
            </div>
            {response.citations.length > 0 && (
              <div className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200/60 dark:border-brand-900/60">
                <FileCheck className="h-3 w-3" />
                <span>{response.citations.length} Sources</span>
              </div>
            )}
          </div>
        </div>

        {/* Answer text with custom markdown styling */}
        <div
          className={clsx(
            'markdown-content',
            isNoAnswer && 'text-amber-800 dark:text-amber-200',
          )}
        >
          <ReactMarkdown>{response.answer}</ReactMarkdown>
        </div>

        {/* Action Toolbar */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800/60">
          <div className="flex items-center gap-1">
            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="Copy answer to clipboard"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Read Aloud button */}
            <button
              onClick={handleSpeak}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                isSpeaking
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 animate-pulse'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
              )}
              title={isSpeaking ? 'Stop reading' : 'Read answer aloud'}
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-brand-600" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>Listen</span>
                </>
              )}
            </button>

            {/* Export Markdown */}
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="Export query and answer as markdown"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>
          </div>

          {/* Feedback buttons */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 mr-1 hidden sm:inline">Helpful?</span>
            <button
              onClick={() => setFeedback((f) => (f === 'up' ? null : 'up'))}
              className={clsx(
                'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                feedback === 'up'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300',
              )}
              title="Helpful"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setFeedback((f) => (f === 'down' ? null : 'down'))}
              className={clsx(
                'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                feedback === 'down'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300',
              )}
              title="Not helpful"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Inline Citations List ── */}
      {!isNoAnswer && response.citations.length > 0 && (
        <div className="space-y-2.5 pl-1">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-brand-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Grounded Citations ({response.citations.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Click excerpt to expand</span>
          </div>

          <div className="space-y-2">
            {response.citations.map((cit, i) => (
              <CitationCard
                key={`${cit.doc_id}-${cit.chunk_index}-${i}`}
                citation={cit}
                index={i + 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Additional retrieved passages (toggle) ── */}
      {hiddenPassages.length > 0 && (
        <div className="space-y-2 pl-1">
          <button
            onClick={() => setShowAllPassages((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white/50 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800"
          >
            <Layers className="h-4 w-4 text-brand-500" />
            <span>
              {showAllPassages
                ? 'Collapse additional retrieved passages'
                : `View ${hiddenPassages.length} more retrieved passage${hiddenPassages.length > 1 ? 's' : ''} (not cited directly)`}
            </span>
            {showAllPassages ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showAllPassages && (
            <div className="animate-fade-in space-y-2 pt-1">
              <p className="px-1 text-[11px] text-slate-400 dark:text-slate-500">
                These passages scored highly in hybrid retrieval (BM25 / FAISS) but were not synthesized into the final grounded citation response.
              </p>
              {hiddenPassages.map((cit, i) => (
                <CitationCard
                  key={`extra-${cit.doc_id}-${cit.chunk_index}-${i}`}
                  citation={cit}
                  index={response.citations.length + i + 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
