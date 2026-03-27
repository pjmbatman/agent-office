import { create } from 'zustand'
import { t } from '../i18n'

export interface ChatMessage {
  id: string
  role: 'ceo' | 'system'
  content: string
  timestamp: number
  tone?: 'normal' | 'error'
}

interface ChatStoreState {
  messages: ChatMessage[]
  addMessage: (role: ChatMessage['role'], content: string) => void
  addErrorMessage: (content: string) => void
  appendTaskResult: (taskId: string, content: string) => void
  appendTaskError: (taskId: string, content: string) => void
  clear: () => void
  deliveredTaskIds: string[]
  failedTaskIds: string[]
}

export const useChatStore = create<ChatStoreState>((set) => ({
  messages: [
    {
      id: '0',
      role: 'system',
      content: t('chat.welcome'),
      timestamp: Date.now()
    }
  ],
  deliveredTaskIds: [],
  failedTaskIds: [],

  addMessage: (role, content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { id: Date.now().toString(), role, content, timestamp: Date.now() }
      ]
    })),

  addErrorMessage: (content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `error-system-${Date.now()}`,
          role: 'system',
          content,
          timestamp: Date.now(),
          tone: 'error'
        }
      ]
    })),

  appendTaskResult: (taskId, content) =>
    set((state) => {
      if (state.deliveredTaskIds.includes(taskId)) {
        return state
      }

      return {
        messages: [
          ...state.messages,
          {
            id: `result-${taskId}`,
            role: 'system',
            content,
            timestamp: Date.now()
          }
        ],
        deliveredTaskIds: [...state.deliveredTaskIds, taskId]
      }
    }),

  appendTaskError: (taskId, content) =>
    set((state) => {
      if (state.failedTaskIds.includes(taskId)) {
        return state
      }

      return {
        messages: [
          ...state.messages,
          {
            id: `task-error-${taskId}`,
            role: 'system',
            content,
            timestamp: Date.now(),
            tone: 'error'
          }
        ],
        failedTaskIds: [...state.failedTaskIds, taskId]
      }
    }),

  clear: () =>
    set({
      messages: [
        {
          id: Date.now().toString(),
          role: 'system',
          content: t('chat.welcome'),
          timestamp: Date.now()
        }
      ],
      deliveredTaskIds: [],
      failedTaskIds: []
    })
}))
