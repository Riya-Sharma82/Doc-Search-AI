import { useState } from 'react'
import { User, Loader2, AlertCircle, Copy, Check } from 'lucide-react'
import type { ChatTurn } from '../types'
import AnswerCard from './AnswerCard'

interface Props {
  turn: ChatTurn
  index: number
}

export default function ChatTurnView({ turn, index }: Props) {
  const [copiedQuery, setCopiedQuery] = useState(false)

  const handleCopyQuery = () => {
    navigator.clipboard.writeText(turn.query)
    setCopiedQuery(true)
    setTimeout(() => setCopiedQuery(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* ── User Query Bubble ── */}
      <div className="flex items-start gap-3 pl-1">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-slate-200 to-slate-300 text-slate-700 shadow-sm dark:from-slate-700 dark:to-slate-800 dark:text-slate-200">
          <User className="h-4 w-4" />
        </div>

        <div className="group min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              You
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              · Question {index}
            </span>
            <button
              onClick={handleCopyQuery}
              className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Copy query"
            >
              {copiedQuery ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>

          <div className="mt-1 inline-block rounded-2xl rounded-tl-sm border border-slate-200/90 bg-white/90 px-4 py-2.5 text-sm font-medium leading-relaxed text-slate-800 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100">
            {turn.query}
          </div>
        </div>
      </div>

      {/* ── Loading Thinking Indicator ── */}
      {turn.loading && (
        <div className="glass-card animate-slide-up ml-3 sm:ml-11 border-brand-200/60 p-4 dark:border-brand-900/40">
          <div className="flex items-center gap-3">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/80 dark:text-brand-400">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Synthesizing Grounded Answer
                </span>
                <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.2 text-[10px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300 animate-pulse">
                  Hybrid Retrieval Active
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Searching vector indices & BM25 rankings · Fusing results · Grounding with Gemini
              </p>
            </div>
          </div>

          {/* Shimmer progress bar */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full w-2/3 animate-shimmer rounded-full bg-gradient-to-r from-brand-500 via-indigo-500 to-accent-500 bg-[length:200%_100%]" />
          </div>
        </div>
      )}

      {/* ── Error State ── */}
      {turn.error && !turn.loading && (
        <div className="ml-3 sm:ml-11 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 shadow-sm backdrop-blur-md dark:border-rose-900/50 dark:bg-rose-950/20">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-800 dark:text-rose-300">
                Search & Synthesis Failed
              </p>
              <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">
                {turn.error}
              </p>
              <p className="mt-2 text-[11px] text-rose-500 dark:text-rose-400">
                Ensure the backend server is reachable on port 8000 and Gemini API key is configured.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Generated Answer Card ── */}
      {turn.response && !turn.loading && (
        <div className="ml-0 sm:ml-4">
          <AnswerCard response={turn.response} turnNumber={index} />
        </div>
      )}
    </div>
  )
}
