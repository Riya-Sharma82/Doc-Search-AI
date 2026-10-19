/** Format a byte count as a human-readable string (KB / MB). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Format an ISO date string to a locale-friendly display. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Format a latency value with a sensible unit. */
export function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

/** Truncate text to maxLen characters. */
export function truncate(text: string, maxLen = 120): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trimEnd() + '…'
}

/** Return a file-type label with colour class. */
export function fileTypeColor(type: string): string {
  const map: Record<string, string> = {
    pdf:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    docx: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    txt:  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  }
  return map[type.toLowerCase()] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
}
