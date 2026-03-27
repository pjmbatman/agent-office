import { create } from 'zustand'
import type { PipelineStage, WorkflowState, TeamId, TeamResult } from '../../shared/types'

interface TaskState {
  currentTaskId: string | null
  workflowState: WorkflowState
  taskDescription: string
  plan: string | null
  pipelineStages: PipelineStage[]
  currentStageKey: string | null
  research: string | null
  implementation: string | null
  reviewFeedback: string | null
  reviewScore: number | null
  revisionCount: number
  artifacts: string[]
  error: string | null

  // Team ensemble
  teamResults: TeamResult[]
  selectedTeamResult: TeamId | null

  // Actions
  updateFromServer: (data: {
    state: WorkflowState
    context: {
      taskId: string
      taskDescription: string
      plan: string | null
      pipelineStages: PipelineStage[]
      currentStageKey: string | null
      research: string | null
      implementation: string | null
      review: { feedback: string; score: number } | null
      revisionCount: number
      artifacts: string[]
      error: string | null
      teamResults?: TeamResult[]
      selectedResult?: TeamId | null
    }
  }) => void
  setEnsembleResults: (results: TeamResult[]) => void
  setSelectedTeamResult: (teamId: TeamId) => void
  reset: () => void
}

export const useTaskStore = create<TaskState>((set) => ({
  currentTaskId: null,
  workflowState: 'idle',
  taskDescription: '',
  plan: null,
  pipelineStages: [],
  currentStageKey: null,
  research: null,
  implementation: null,
  reviewFeedback: null,
  reviewScore: null,
  revisionCount: 0,
  artifacts: [],
  error: null,
  teamResults: [],
  selectedTeamResult: null,

  updateFromServer: (data) =>
    set({
      currentTaskId: data.context.taskId || null,
      workflowState: data.state,
      taskDescription: data.context.taskDescription,
      plan: data.context.plan,
      pipelineStages: data.context.pipelineStages || [],
      currentStageKey: data.context.currentStageKey,
      research: data.context.research,
      implementation: data.context.implementation,
      reviewFeedback: data.context.review?.feedback || null,
      reviewScore: data.context.review?.score || null,
      revisionCount: data.context.revisionCount,
      artifacts: data.context.artifacts,
      error: data.context.error,
      teamResults: data.context.teamResults || [],
      selectedTeamResult: data.context.selectedResult || null,
    }),

  setEnsembleResults: (results) => set({ teamResults: results }),

  setSelectedTeamResult: (teamId) => set({ selectedTeamResult: teamId }),

  reset: () =>
    set({
      currentTaskId: null,
      workflowState: 'idle',
      taskDescription: '',
      plan: null,
      pipelineStages: [],
      currentStageKey: null,
      research: null,
      implementation: null,
      reviewFeedback: null,
      reviewScore: null,
      revisionCount: 0,
      artifacts: [],
      error: null,
      teamResults: [],
      selectedTeamResult: null,
    })
}))
