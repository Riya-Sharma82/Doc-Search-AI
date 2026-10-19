import { SlidersHorizontal, Cpu, RotateCcw, Check } from 'lucide-react'
import clsx from 'clsx'
import { useState } from 'react'
import type { DocumentListItem, SearchSettings } from '../types'

interface Props {
  settings: SearchSettings
  onChange: (s: SearchSettings) => void
  documents: DocumentListItem[]
}

const DEFAULT_SETTINGS: SearchSettings = {
  topK: 5,
  hybridAlpha: 0.5,
  enableReranker: false,
  filterDocIds: [],
}

export default function SettingsPanel({ settings, onChange, documents }: Props) {
  const [resetFeedback, setResetFeedback] = useState(false)

  const set = <K extends keyof SearchSettings>(key: K, val: SearchSettings[K]) =>
    onChange({ ...settings, [key]: val })

  const toggleDocFilter = (docId: string) => {
    const ids = settings.filterDocIds
    set(
      'filterDocIds',
      ids.includes(docId) ? ids.filter((id) => id !== docId) : [...ids, docId],
    )
  }

  const handleReset = () => {
    onChange(DEFAULT_SETTINGS)
    setResetFeedback(true)
    setTimeout(() => setResetFeedback(false), 2000)
  }

  // Calculate percentages for hybrid visualizer
  const semanticPct = Math.round(settings.hybridAlpha * 100)
  const keywordPct = 100 - semanticPct

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Retrieval & Search Tuning
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Fine-tune the hybrid search balance, reranker, and scope
            </p>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300"
          title="Reset to recommended defaults"
        >
          {resetFeedback ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">Reset Done</span>
            </>
          ) : (
            <>
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Defaults</span>
            </>
          )}
        </button>
      </div>

      {/* ── 1. Interactive Hybrid Search Visualizer ── */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Hybrid Search Weight (α = {settings.hybridAlpha.toFixed(2)})
              </h3>
              <span className="rounded-md bg-brand-50 px-2 py-0.2 text-[10px] font-semibold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                {settings.hybridAlpha === 0.5 ? 'Balanced RRF' : settings.hybridAlpha < 0.5 ? 'BM25 Focused' : 'Dense Vector Focused'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Controls the ratio between sparse BM25 keyword matching and dense FAISS semantic vectors.
            </p>
          </div>
        </div>

        {/* Dynamic visual split bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-blue-600 dark:text-blue-400 font-mono">
              BM25 Keyword: {keywordPct}%
            </span>
            <span className="text-brand-600 dark:text-brand-400 font-mono">
              Semantic Vector: {semanticPct}%
            </span>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 flex dark:bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-150"
              style={{ width: `${keywordPct}%` }}
              title={`BM25: ${keywordPct}%`}
            />
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-accent-500 transition-all duration-150"
              style={{ width: `${semanticPct}%` }}
              title={`Semantic: ${semanticPct}%`}
            />
          </div>
        </div>

        {/* Slider */}
        <div className="pt-2">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.hybridAlpha}
            onChange={(e) => set('hybridAlpha', Number(e.target.value))}
            className="w-full accent-brand-600 h-2 cursor-pointer bg-slate-200 dark:bg-slate-700 rounded-lg"
          />
        </div>

        {/* Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-400">Presets:</span>
          {[
            { label: 'Keyword Only (0.0)', val: 0.0 },
            { label: 'Keyword Focus (0.3)', val: 0.3 },
            { label: 'Balanced (0.5)', val: 0.5 },
            { label: 'Semantic Focus (0.7)', val: 0.7 },
            { label: 'Semantic Only (1.0)', val: 1.0 },
          ].map((p) => (
            <button
              key={p.label}
              onClick={() => set('hybridAlpha', p.val)}
              className={clsx(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
                Math.abs(settings.hybridAlpha - p.val) < 0.01
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. Top-K Passages ── */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Retrieval Depth (Top-K Passages: {settings.topK})
            </h3>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Number of most relevant passage chunks retrieved to construct the Gemini synthesis prompt.
            </p>
          </div>
          <span className="text-lg font-black text-brand-600 dark:text-brand-400">
            {settings.topK}
          </span>
        </div>

        <input
          type="range"
          min={1}
          max={20}
          step={1}
          value={settings.topK}
          onChange={(e) => set('topK', Number(e.target.value))}
          className="w-full accent-brand-600 h-2 cursor-pointer bg-slate-200 dark:bg-slate-700 rounded-lg"
        />

        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-slate-400">Quick set:</span>
          {[3, 5, 8, 12, 15].map((k) => (
            <button
              key={k}
              onClick={() => set('topK', k)}
              className={clsx(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
                settings.topK === k
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400',
              )}
            >
              {k} chunks
            </button>
          ))}
        </div>
      </div>

      {/* ── 3. Cross-Encoder Reranker ── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Cross-Encoder Reranker
              </h3>
              <span
                className={clsx(
                  'badge text-[10px]',
                  settings.enableReranker
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                )}
              >
                {settings.enableReranker ? 'Active' : 'Disabled'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Re-scores candidate passages using a cross-encoder model for enhanced precision. Adds ~200-400ms latency.
            </p>
          </div>

          <label className="relative inline-flex cursor-pointer items-center shrink-0">
            <input
              type="checkbox"
              checked={settings.enableReranker}
              onChange={(e) => set('enableReranker', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-brand-600" />
          </label>
        </div>
      </div>

      {/* ── 4. Document Filter Scope ── */}
      {documents.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Active Knowledge Scope
            </h3>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {settings.filterDocIds.length === 0
                ? 'All documents are currently searchable.'
                : `Queries are restricted to ${settings.filterDocIds.length} of ${documents.length} documents.`}
            </p>
          </div>

          <div className="space-y-1.5 pt-1">
            {documents.map((doc) => {
              const checked =
                settings.filterDocIds.length === 0 ||
                settings.filterDocIds.includes(doc.doc_id)
              return (
                <label
                  key={doc.doc_id}
                  className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDocFilter(doc.doc_id)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-300 flex-1">
                    {doc.filename}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {doc.total_chunks} chunks
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 5. System Architecture Diagnostic Card ── */}
      <div className="rounded-2xl border border-brand-200/60 bg-gradient-to-br from-brand-50/50 via-white/40 to-accent-50/50 p-5 backdrop-blur-xl dark:border-brand-900/40 dark:from-brand-950/20 dark:via-slate-900/40 dark:to-accent-950/20">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="h-4 w-4 text-brand-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Pipeline Architecture Diagnostics
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl bg-white/70 p-3 shadow-xs dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-800/60">
            <span className="text-slate-400 block text-[11px]">Vector Store</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">FAISS IndexFlatIP (Dense)</span>
          </div>
          <div className="rounded-xl bg-white/70 p-3 shadow-xs dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-800/60">
            <span className="text-slate-400 block text-[11px]">Embedding Model</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">all-MiniLM-L6-v2 (384-dim)</span>
          </div>
          <div className="rounded-xl bg-white/70 p-3 shadow-xs dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-800/60">
            <span className="text-slate-400 block text-[11px]">Keyword Retrieval</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">BM25Okapi (Inverted Index)</span>
          </div>
          <div className="rounded-xl bg-white/70 p-3 shadow-xs dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-800/60">
            <span className="text-slate-400 block text-[11px]">Synthesis LLM</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">Google Gemini 1.5 Flash</span>
          </div>
        </div>
      </div>
    </div>
  )
}
