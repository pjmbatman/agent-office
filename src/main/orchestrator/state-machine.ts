import { setup, assign } from 'xstate'
import type { TeamId, TeamResult, WorkflowState } from '../../shared/types'

// ===== Context =====

export interface WorkflowContext {
  taskId: string
  taskDescription: string
  teamResults: TeamResult[]
  selectedResult: TeamId | null
  implementation: string | null
  error: string | null
  // Legacy compat fields used by renderer
  plan: string | null
  evaluationCriteria: string[] | null
  pipelineStages: Array<{ key: string; label: string; role?: string | null; goal?: string; teamId?: string }>
  currentStageKey: string | null
  research: string | null
  review: { approved: boolean; feedback: string; score: number } | null
  revisionCount: number
  artifacts: string[]
}

// ===== Events =====

export type WorkflowEvent =
  | { type: 'TASK_SUBMIT'; description: string }
  | { type: 'FAST_TRACK_COMPLETE'; plan: string; implementation: string }
  | { type: 'ALL_TEAMS_COMPLETE'; results: TeamResult[] }
  | { type: 'CEO_SELECTED'; selectedTeamId: TeamId }
  | { type: 'TASK_DISMISS' }
  | { type: 'CEO_OVERRIDE'; action: 'cancel' | 'approve' }
  | { type: 'ERROR'; message: string }

const initialContext: WorkflowContext = {
  taskId: '',
  taskDescription: '',
  teamResults: [],
  selectedResult: null,
  implementation: null,
  error: null,
  plan: null,
  evaluationCriteria: null,
  pipelineStages: [],
  currentStageKey: null,
  research: null,
  review: null,
  revisionCount: 0,
  artifacts: [],
}

export const workflowMachine = setup({
  types: {
    context: {} as WorkflowContext,
    events: {} as WorkflowEvent
  },
  guards: {
    singleResult: ({ event }) => {
      const e = event as Extract<WorkflowEvent, { type: 'ALL_TEAMS_COMPLETE' }>
      return e.results.length === 1
    },
    multipleResults: ({ event }) => {
      const e = event as Extract<WorkflowEvent, { type: 'ALL_TEAMS_COMPLETE' }>
      return e.results.length > 1
    },
    ceoCancels: ({ event }) => {
      return (event as Extract<WorkflowEvent, { type: 'CEO_OVERRIDE' }>).action === 'cancel'
    },
    ceoApproves: ({ event }) => {
      return (event as Extract<WorkflowEvent, { type: 'CEO_OVERRIDE' }>).action === 'approve'
    },
  },
  actions: {
    assignTask: assign({
      taskId: () => Date.now().toString(),
      taskDescription: ({ event }) => (event as Extract<WorkflowEvent, { type: 'TASK_SUBMIT' }>).description,
      teamResults: [],
      selectedResult: null,
      implementation: null,
      error: null,
      plan: null,
      evaluationCriteria: null,
      pipelineStages: [],
      currentStageKey: null,
      research: null,
      review: null,
      revisionCount: 0,
      artifacts: [],
    }),
    assignFastTrack: assign({
      plan: ({ event }) => (event as Extract<WorkflowEvent, { type: 'FAST_TRACK_COMPLETE' }>).plan,
      implementation: ({ event }) => (event as Extract<WorkflowEvent, { type: 'FAST_TRACK_COMPLETE' }>).implementation,
      review: () => ({ approved: true, feedback: 'Fast-path response', score: 100 }),
    }),
    assignTeamResults: assign({
      teamResults: ({ event }) => (event as Extract<WorkflowEvent, { type: 'ALL_TEAMS_COMPLETE' }>).results,
    }),
    assignSingleResult: assign({
      teamResults: ({ event }) => (event as Extract<WorkflowEvent, { type: 'ALL_TEAMS_COMPLETE' }>).results,
      implementation: ({ event }) => {
        const results = (event as Extract<WorkflowEvent, { type: 'ALL_TEAMS_COMPLETE' }>).results
        return results[0]?.result || null
      },
      selectedResult: ({ event }) => {
        const results = (event as Extract<WorkflowEvent, { type: 'ALL_TEAMS_COMPLETE' }>).results
        return results[0]?.teamId || null
      },
      review: ({ event }) => {
        const results = (event as Extract<WorkflowEvent, { type: 'ALL_TEAMS_COMPLETE' }>).results
        const r = results[0]
        return r ? { approved: r.satisfied, feedback: `Team ${r.teamId} completed`, score: r.satisfied ? 90 : 60 } : null
      },
    }),
    assignSelectedResult: assign({
      selectedResult: ({ event }) => (event as Extract<WorkflowEvent, { type: 'CEO_SELECTED' }>).selectedTeamId,
      implementation: ({ context, event }) => {
        const teamId = (event as Extract<WorkflowEvent, { type: 'CEO_SELECTED' }>).selectedTeamId
        return context.teamResults.find((r) => r.teamId === teamId)?.result || context.implementation
      },
      review: ({ context, event }) => {
        const teamId = (event as Extract<WorkflowEvent, { type: 'CEO_SELECTED' }>).selectedTeamId
        const r = context.teamResults.find((tr) => tr.teamId === teamId)
        return r ? { approved: true, feedback: `CEO selected Team ${teamId}`, score: r.satisfied ? 95 : 70 } : null
      },
    }),
    assignError: assign({
      error: ({ event }) => (event as Extract<WorkflowEvent, { type: 'ERROR' }>).message,
    }),
    clearState: assign({ ...initialContext }),
  }
}).createMachine({
  id: 'workflow',
  initial: 'idle',
  context: { ...initialContext },
  states: {
    idle: {
      on: {
        TASK_SUBMIT: {
          target: 'teams-working',
          actions: 'assignTask',
        },
      },
    },

    'teams-working': {
      on: {
        FAST_TRACK_COMPLETE: {
          target: 'complete',
          actions: 'assignFastTrack',
        },
        ALL_TEAMS_COMPLETE: [
          {
            guard: 'singleResult',
            target: 'complete',
            actions: 'assignSingleResult',
          },
          {
            guard: 'multipleResults',
            target: 'ceo-comparing',
            actions: 'assignTeamResults',
          },
        ],
        ERROR: {
          target: 'idle',
          actions: 'assignError',
        },
        CEO_OVERRIDE: [
          { guard: 'ceoCancels', target: 'idle', actions: 'clearState' },
        ],
      },
    },

    'ceo-comparing': {
      on: {
        CEO_SELECTED: {
          target: 'complete',
          actions: 'assignSelectedResult',
        },
        CEO_OVERRIDE: [
          { guard: 'ceoApproves', target: 'complete' },
          { guard: 'ceoCancels', target: 'idle', actions: 'clearState' },
        ],
      },
    },

    complete: {
      on: {
        TASK_DISMISS: {
          target: 'idle',
          actions: 'clearState',
        },
        TASK_SUBMIT: {
          target: 'teams-working',
          actions: 'assignTask',
        },
      },
    },
  },
})
