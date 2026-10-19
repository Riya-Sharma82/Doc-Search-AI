import { useCallback, useState } from 'react'
import { extractErrorMessage, search } from '../services/api'
import type { ChatTurn, ConversationMessage, SearchSettings } from '../types'

let turnIdCounter = 0

export function useSearch() {
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Build Gemini-compatible history from previous turns
  const buildHistory = (turns: ChatTurn[]): ConversationMessage[] => {
    const history: ConversationMessage[] = []
    for (const t of turns) {
      if (!t.response) continue
      history.push({ role: 'user',  parts: [t.query] })
      history.push({ role: 'model', parts: [t.response.answer] })
    }
    return history
  }

  const ask = useCallback(
    async (query: string, settings: SearchSettings): Promise<void> => {
      const id = String(++turnIdCounter)
      const loadingTurn: ChatTurn = {
        id,
        query,
        response: null,
        error: null,
        loading: true,
        timestamp: new Date(),
      }

      setTurns((prev) => [...prev, loadingTurn])
      setIsSearching(true)

      try {
        const history = buildHistory(turns)
        const response = await search({
          query,
          top_k: settings.topK,
          hybrid_alpha: settings.hybridAlpha,
          enable_reranker: settings.enableReranker,
          conversation_history: history,
          doc_ids: settings.filterDocIds.length > 0 ? settings.filterDocIds : undefined,
        })

        setTurns((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, response, loading: false } : t,
          ),
        )
      } catch (err) {
        setTurns((prev) =>
          prev.map((t) =>
            t.id === id
              ? { ...t, error: extractErrorMessage(err), loading: false }
              : t,
          ),
        )
      } finally {
        setIsSearching(false)
      }
    },
    [turns],
  )

  const clearHistory = useCallback(() => setTurns([]), [])

  return { turns, isSearching, ask, clearHistory }
}
