import { useCallback, useEffect, useState } from 'react'
import { deleteDocument, extractErrorMessage, fetchDocuments, uploadDocuments } from '../services/api'
import type { DocumentListItem, UploadResponse } from '../types'

export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const docs = await fetchDocuments()
      setDocuments(docs)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const upload = useCallback(
    async (
      files: File[],
      onProgress?: (pct: number) => void,
    ): Promise<UploadResponse[]> => {
      const results = await uploadDocuments(files, onProgress)
      await refresh()
      return results
    },
    [refresh],
  )

  const remove = useCallback(
    async (docId: string): Promise<void> => {
      await deleteDocument(docId)
      setDocuments((prev) => prev.filter((d) => d.doc_id !== docId))
    },
    [],
  )

  return { documents, loading, error, refresh, upload, remove }
}
