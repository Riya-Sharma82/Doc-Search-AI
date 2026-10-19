import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CloudUpload,
  FileUp,
} from 'lucide-react'
import clsx from 'clsx'
import type { UploadResponse } from '../types'
import { extractErrorMessage } from '../services/api'
import { formatBytes } from '../utils/format'

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
}
const MAX_SIZE_MB = 50

interface FileEntry {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  progress: number
  result?: UploadResponse
  error?: string
}

interface Props {
  onUploadComplete: () => void
  upload: (files: File[], onProgress?: (pct: number) => void) => Promise<UploadResponse[]>
}

export default function UploadZone({ onUploadComplete, upload }: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [isDragActive, setIsDragActive] = useState(false)

  const updateEntry = (id: string, patch: Partial<FileEntry>) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  const addFiles = useCallback((accepted: File[]) => {
    const newEntries: FileEntry[] = accepted.map((file) => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      status: 'pending',
      progress: 0,
    }))
    setEntries((prev) => [...prev, ...newEntries])
  }, [])

  const removeEntry = (id: string) =>
    setEntries((prev) => prev.filter((e) => e.id !== id))

  const clearDone = () => {
    setEntries((prev) => prev.filter((e) => e.status !== 'done'))
  }

  const uploadAll = async () => {
    const pending = entries.filter((e) => e.status === 'pending')
    if (!pending.length) return

    for (const entry of pending) {
      updateEntry(entry.id, { status: 'uploading', progress: 0 })
      try {
        const results = await upload([entry.file], (pct) =>
          updateEntry(entry.id, { progress: pct }),
        )
        updateEntry(entry.id, { status: 'done', progress: 100, result: results[0] })
      } catch (err) {
        updateEntry(entry.id, { status: 'error', error: extractErrorMessage(err) })
      }
    }
    onUploadComplete()
  }

  const { getRootProps, getInputProps } = useDropzone({
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE_MB * 1024 * 1024,
    multiple: true,
    onDrop: addFiles,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    onDropAccepted: () => setIsDragActive(false),
    onDropRejected: (rejections) => {
      setIsDragActive(false)
      const errorEntries: FileEntry[] = rejections.map((r) => ({
        file: r.file,
        id: `${r.file.name}-rejected-${Date.now()}`,
        status: 'error',
        progress: 0,
        error: r.errors.map((e) => e.message).join(', '),
      }))
      setEntries((prev) => [...prev, ...errorEntries])
    },
  })

  const hasPending = entries.some((e) => e.status === 'pending')
  const isUploading = entries.some((e) => e.status === 'uploading')
  const hasDone = entries.some((e) => e.status === 'done')

  return (
    <div className="space-y-4">
      {/* Drop zone container */}
      <div
        {...getRootProps()}
        className={clsx(
          'relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200',
          isDragActive
            ? 'border-brand-500 bg-brand-50/80 ring-4 ring-brand-500/10 dark:bg-brand-950/30'
            : 'border-slate-300/80 hover:border-brand-400 hover:bg-slate-50/60 dark:border-slate-700/80 dark:hover:border-brand-600 dark:hover:bg-slate-900/40',
        )}
      >
        <input {...getInputProps()} />

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-accent-600 text-white shadow-md shadow-brand-500/25 mb-3">
          <CloudUpload className="h-6 w-6" />
        </div>

        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Drag & drop your documents here, or{' '}
          <span className="text-brand-600 dark:text-brand-400 hover:underline">browse</span>
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Supports PDF, Word (.docx), and plain text (.txt) up to {MAX_SIZE_MB} MB
        </p>

        {/* Format chips */}
        <div className="mt-4 flex items-center gap-2">
          <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
            PDF
          </span>
          <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300">
            DOCX
          </span>
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
            TXT
          </span>
        </div>
      </div>

      {/* Selected file queue */}
      {entries.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-white/60 p-4 dark:border-slate-800/80 dark:bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Queue ({entries.length} file{entries.length > 1 ? 's' : ''})
            </span>
            <div className="flex items-center gap-2">
              {hasDone && (
                <button
                  type="button"
                  onClick={clearDone}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Clear finished
                </button>
              )}
              {hasPending && (
                <button
                  type="button"
                  onClick={uploadAll}
                  disabled={isUploading}
                  className="btn-gradient py-1.5 px-3 text-xs"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Indexing...</span>
                    </>
                  ) : (
                    <>
                      <FileUp className="h-3.5 w-3.5" />
                      <span>Index All ({entries.filter((e) => e.status === 'pending').length})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-2.5 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-800/90"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800 dark:text-slate-200">
                      {entry.file.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {formatBytes(entry.file.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {entry.status === 'uploading' && (
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full bg-brand-600 transition-all duration-200"
                          style={{ width: `${entry.progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-brand-600 dark:text-brand-400">
                        {entry.progress}%
                      </span>
                    </div>
                  )}

                  {entry.status === 'done' && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      Indexed ({entry.result?.total_chunks ?? 0} chunks)
                    </span>
                  )}

                  {entry.status === 'error' && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                      <AlertCircle className="h-3 w-3" />
                      {entry.error ?? 'Failed'}
                    </span>
                  )}

                  {entry.status === 'pending' && (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      Ready to index
                    </span>
                  )}

                  {entry.status !== 'uploading' && (
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
