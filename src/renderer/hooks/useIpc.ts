import { useEffect } from 'react'
import { useTaskStore } from '../stores/task-store'
import { useAgentStore } from '../stores/agent-store'
import { useChatStore } from '../stores/chat-store'
import type { AgentStatusUpdate, AgentOutputChunk, PipelineStage, WorkflowState, TeamResult, TeamId } from '../../shared/types'
import { getAgentOffice } from '../lib/agent-office'

/**
 * Hook to subscribe to IPC events from the main process
 * and update Zustand stores accordingly.
 */
export function useIpcListeners(): void {
  const updateFromServer = useTaskStore((s) => s.updateFromServer)
  const setEnsembleResults = useTaskStore((s) => s.setEnsembleResults)
  const updateAgentStatus = useAgentStore((s) => s.updateStatus)
  const appendOutput = useAgentStore((s) => s.appendOutput)
  const appendTranscript = useAgentStore((s) => s.appendTranscript)
  const appendTaskResult = useChatStore((s) => s.appendTaskResult)
  const appendTaskError = useChatStore((s) => s.appendTaskError)

  useEffect(() => {
    const api = getAgentOffice()

    const unsubTaskState = api.onTaskStateUpdate((data: unknown) => {
      const d = data as {
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
      }
      updateFromServer(d)

      if (d.state === 'complete' && d.context.taskId && d.context.implementation) {
        appendTaskResult(d.context.taskId, d.context.implementation)
      }

      if (d.context.error && d.context.taskId) {
        appendTaskError(d.context.taskId, d.context.error)
      }
    })

    const unsubAgentStatus = api.onAgentStatus((data: unknown) => {
      const d = data as AgentStatusUpdate
      updateAgentStatus(d.role, d.status as any, d.currentAction, d.provider, d.target.type)

      if (d.currentAction) {
        appendTranscript(d.role, 'status', d.currentAction)
      }
    })

    const unsubAgentOutput = api.onAgentOutputChunk((data: unknown) => {
      const d = data as AgentOutputChunk
      if (d.event.type === 'text-delta' && d.event.content) {
        appendOutput(d.role, d.event.content)
        appendTranscript(d.role, 'output', d.event.content)
      }
      if ((d.event.type === 'tool-use' || d.event.type === 'tool-result') && d.event.content) {
        appendTranscript(d.role, 'output', d.event.content)
      }
      if (d.event.type === 'error' && d.event.content) {
        appendTranscript(d.role, 'error', d.event.content.trim())
      }
    })

    const unsubEnsemble = api.onEnsembleResults((data: unknown) => {
      const results = data as TeamResult[]
      setEnsembleResults(results)
    })

    return () => {
      unsubTaskState()
      unsubAgentStatus()
      unsubAgentOutput()
      unsubEnsemble()
    }
  }, [updateFromServer, setEnsembleResults, updateAgentStatus, appendOutput, appendTranscript, appendTaskResult, appendTaskError])
}
