import { Search, FileText, SlidersHorizontal, Sun, Moon, Sparkles, Upload } from 'lucide-react'
import clsx from 'clsx'
import type { ActiveTab, Theme } from '../types'

interface Props {
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
  theme: Theme
  onToggleTheme: () => void
  documentCount: number
  backendOnline: boolean | null
  onOpenUpload?: () => void
}

const TABS: { id: ActiveTab; label: string; icon: typeof Search }[] = [
  { id: 'search',    label: 'Search & QA', icon: Search },
  { id: 'documents', label: 'Documents',   icon: FileText },
  { id: 'settings',  label: 'Tuning',      icon: SlidersHorizontal },
]

export default function Navbar({
  activeTab,
  onTabChange,
  theme,
  onToggleTheme,
  documentCount,
  backendOnline,
  onOpenUpload,
}: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#090d16]/80 transition-colors">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onTabChange('search')}
            className="group flex items-center gap-2.5 text-left focus:outline-none"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-accent-500 shadow-md shadow-brand-500/25 transition-transform duration-200 group-hover:scale-105 group-hover:shadow-brand-500/40">
              <Sparkles className="h-4 w-4 text-white animate-pulse-slow" />
              <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-slate-900 dark:text-white text-base">
                  DocSearch
                </span>
                <span className="rounded-md bg-gradient-to-r from-brand-600 to-accent-600 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase shadow-sm">
                  AI
                </span>
              </div>
              <p className="hidden sm:block text-[10px] font-medium text-slate-400 dark:text-slate-500">
                Hybrid RAG · Gemini Grounded
              </p>
            </div>
          </button>

          {/* Backend Status Dot */}
          <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50/80 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            {backendOnline === true && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-emerald-700 dark:text-emerald-400">Engine Online</span>
              </>
            )}
            {backendOnline === false && (
              <>
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span className="text-rose-600 dark:text-rose-400">Engine Disconnected</span>
              </>
            )}
            {backendOnline === null && (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Checking...</span>
              </>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-100/70 p-1 dark:border-slate-800 dark:bg-slate-900/80">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={clsx(
                  'relative flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/40',
                )}
              >
                <Icon className={clsx('h-4 w-4', isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400')} />
                <span>{label}</span>
                {id === 'documents' && (
                  <span
                    className={clsx(
                      'ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold transition-colors',
                      documentCount > 0
                        ? 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800/60'
                        : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                    )}
                  >
                    {documentCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {onOpenUpload && (
            <button
              onClick={onOpenUpload}
              className="hidden md:inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50/70 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-all hover:bg-brand-100 hover:border-brand-300 dark:border-brand-900/60 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/40 active:scale-95"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Docs</span>
            </button>
          )}

          {/* Theme Switcher */}
          <button
            onClick={onToggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white active:scale-95"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400 transition-transform duration-200 rotate-0 hover:rotate-45" />
            ) : (
              <Moon className="h-4 w-4 text-brand-600 transition-transform duration-200 -rotate-12 hover:rotate-0" />
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
