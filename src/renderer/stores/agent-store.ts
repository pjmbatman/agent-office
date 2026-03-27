import { create } from 'zustand'
import type { AgentRole, AgentStatus, ProviderType } from '../../shared/types'

export interface AgentTranscriptEntry {
  id: string
  kind: 'status' | 'output' | 'error'
  content: string
  timestamp: number
}

interface AgentInfo {
  role: AgentRole
  status: AgentStatus
  currentAction: string
  provider: ProviderType
  targetType: 'local' | 'remote'
  lastOutput: string
  transcript: AgentTranscriptEntry[]
}

interface AgentStoreState {
  agents: Record<AgentRole, AgentInfo>
  selectedAgent: AgentRole | null

  updateStatus: (role: AgentRole, status: AgentStatus, action?: string, provider?: ProviderType, targetType?: string) => void
  appendOutput: (role: AgentRole, text: string) => void
  appendTranscript: (role: AgentRole, kind: AgentTranscriptEntry['kind'], content: string) => void
  clearOutput: (role: AgentRole) => void
  selectAgent: (role: AgentRole | null) => void
  resetAll: () => void
}

const defaultAgent = (role: AgentRole): AgentInfo => ({
  role,
  status: 'idle',
  currentAction: '',
  provider: 'codex',
  targetType: 'local',
  lastOutput: '',
  transcript: []
})

const TEAM_AGENTS = [
  'alpha-lead', 'alpha-senior', 'alpha-worker1', 'alpha-worker2',
  'beta-lead', 'beta-senior', 'beta-worker1', 'beta-worker2',
] as const

const initialAgents: Record<AgentRole, AgentInfo> = Object.fromEntries(
  TEAM_AGENTS.map((role) => [role, defaultAgent(role)])
) as Record<AgentRole, AgentInfo>

export const useAgentStore = create<AgentStoreState>((set) => ({
  agents: { ...initialAgents },
  selectedAgent: null,

  updateStatus: (role, status, action, provider, targetType) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [role]: {
          ...(state.agents[role] || defaultAgent(role)),
          status,
          currentAction: action || state.agents[role]?.currentAction || '',
          provider: provider || state.agents[role]?.provider || 'codex',
          targetType: (targetType as 'local' | 'remote' | undefined) || state.agents[role]?.targetType || 'local'
        }
      }
    })),

  appendOutput: (role, text) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [role]: {
          ...(state.agents[role] || defaultAgent(role)),
          lastOutput: (state.agents[role]?.lastOutput || '') + text
        }
      }
    })),

  appendTranscript: (role, kind, content) =>
    set((state) => {
      const current = state.agents[role] || defaultAgent(role)
      const transcript = [...current.transcript]
      const last = transcript[transcript.length - 1]

      if (last && last.kind === kind && kind !== 'status') {
        transcript[transcript.length - 1] = {
          ...last,
          content: `${last.content}${content}`,
          timestamp: Date.now()
        }
      } else {
        transcript.push({
          id: `${role}-${kind}-${Date.now()}-${transcript.length}`,
          kind,
          content,
          timestamp: Date.now()
        })
      }

      return {
        agents: {
          ...state.agents,
          [role]: {
            ...current,
            transcript
          }
        }
      }
    }),

  clearOutput: (role) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [role]: { ...(state.agents[role] || defaultAgent(role)), lastOutput: '', transcript: [] }
      }
    })),

  selectAgent: (role) => set({ selectedAgent: role }),

  resetAll: () =>
    set({
      agents: { ...initialAgents },
      selectedAgent: null
    })
}))
