import { useState, useEffect } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import type { ActiveTab, DocumentListItem, SearchSettings } from './types'
import { useTheme } from './hooks/useTheme'
import { useDocuments } from './hooks/useDocuments'
import { fetchHealth } from './services/api'
import Navbar from './components/Navbar'
import SearchPanel from './components/SearchPanel'
import DocumentsPanel from './components/DocumentsPanel'
import SettingsPanel from './components/SettingsPanel'

const DEFAULT_SETTINGS: SearchSettings = {
  topK: 5,
  hybridAlpha: 0.5,
  enableReranker: false,
  filterDocIds: [],
}

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<ActiveTab>('search')
  const [settings, setSettings] = useState<SearchSettings>(DEFAULT_SETTINGS)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)

  const { documents, loading, error, refresh, upload, remove } = useDocuments()

  const checkHealth = () => {
    fetchHealth()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false))
  }

  // Check backend health on mount
  useEffect(() => {
    checkHealth()
  }, [])

  const handleAskAboutDoc = (doc: DocumentListItem) => {
    setSettings((prev) => ({
      ...prev,
      filterDocIds: [doc.doc_id],
    }))
    setActiveTab('search')
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-[#090d16] dark:text-slate-100 transition-colors selection:bg-brand-500 selection:text-white">
      {/* ── Ambient Background Lighting Mesh ── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-gradient-to-tr from-brand-500/10 via-indigo-500/15 to-accent-500/10 blur-[130px] dark:from-brand-600/20 dark:via-indigo-600/20 dark:to-accent-600/15" />
        <div className="absolute top-1/3 -left-48 h-96 w-96 rounded-full bg-indigo-500/5 blur-[120px] dark:bg-indigo-600/10" />
        <div className="absolute top-2/3 -right-48 h-96 w-96 rounded-full bg-accent-500/5 blur-[120px] dark:bg-accent-600/10" />
      </div>

      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        theme={theme}
        onToggleTheme={toggleTheme}
        documentCount={documents.length}
        backendOnline={backendOnline}
        onOpenUpload={() => setActiveTab('documents')}
      />

      {/* Backend offline toast/banner */}
      {backendOnline === false && (
        <div className="mx-auto mt-4 max-w-4xl px-4 w-full">
          <div className="flex items-center justify-between rounded-2xl border border-rose-300 bg-rose-50/90 px-4 py-3 text-xs text-rose-800 shadow-sm backdrop-blur-md dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            <div className="flex items-center gap-2">
              <WifiOff className="h-4 w-4 shrink-0 text-rose-500" />
              <span>
                Backend server is currently unreachable on <code className="rounded bg-rose-200/60 px-1 py-0.5 font-mono text-[11px] dark:bg-rose-900/60">localhost:8000</code>. Please ensure the FastAPI backend is running.
              </span>
            </div>
            <button
              onClick={checkHealth}
              className="inline-flex items-center gap-1 font-semibold hover:underline shrink-0 ml-3 text-rose-700 dark:text-rose-300"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Main Workspace Content ── */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {activeTab === 'search' && (
          <div className="flex h-[calc(100vh-8.5rem)] flex-col">
            <SearchPanel
              settings={settings}
              documentCount={documents.length}
              documents={documents}
              onOpenUpload={() => setActiveTab('documents')}
            />
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="animate-fade-in">
            <DocumentsPanel
              documents={documents}
              loading={loading}
              error={error}
              onRefresh={refresh}
              onDelete={remove}
              upload={upload}
              onAskAboutDoc={handleAskAboutDoc}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-fade-in">
            <SettingsPanel
              settings={settings}
              onChange={setSettings}
              documents={documents}
            />
          </div>
        )}
      </main>

      {/* ── Modern Footer ── */}
      <footer className="border-t border-slate-200/80 bg-white/40 py-3.5 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#090d16]/40 transition-colors text-center text-xs text-slate-400 dark:text-slate-500">
        <div className="mx-auto flex max-w-5xl flex-col sm:flex-row items-center justify-between px-4 sm:px-6 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">DocSearch AI</span>
            <span>·</span>
            <span>Document-Grounded Semantic Search System</span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span>FAISS FlatIP</span>
            <span>•</span>
            <span>BM25Okapi</span>
            <span>•</span>
            <span>Gemini 1.5 Flash</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
