import { useEffect } from 'react'
import { useAgentStore } from '../stores/agent-store'
import { useTaskStore } from '../stores/task-store'
import { useLocaleStore } from '../i18n'
import { gameBridge } from '../game/bridge'
import type { AgentRole } from '../../shared/types'

/**
 * Syncs Zustand store changes → Phaser via gameBridge.
 * Also listens for Phaser → React events.
 */
export function useGameBridge(): void {
  const agents = useAgentStore((s) => s.agents)
  const selectAgent = useAgentStore((s) => s.selectAgent)
  const selectedAgent = useAgentStore((s) => s.selectedAgent)
  const workflowState = useTaskStore((s) => s.workflowState)
  const locale = useLocaleStore((s) => s.locale)

  // Forward agent status to Phaser
  useEffect(() => {
    for (const role of Object.keys(agents) as AgentRole[]) {
      const agent = agents[role]
      gameBridge.emit('agent:state-changed', role, agent.status, agent.currentAction)
    }
  }, [agents])

  // Forward workflow state to Phaser
  useEffect(() => {
    gameBridge.emit('task:state-changed', workflowState)
  }, [workflowState])

  useEffect(() => {
    gameBridge.emit('agent:selected', selectedAgent)
  }, [selectedAgent])

  // Forward locale changes to Phaser
  useEffect(() => {
    gameBridge.emit('locale:changed', locale)
  }, [locale])

  useEffect(() => {
    const onCharacterClick = (role: AgentRole) => selectAgent(role)
    gameBridge.on('character:clicked', onCharacterClick)

    return () => {
      gameBridge.off('character:clicked', onCharacterClick)
    }
  }, [selectAgent])
}
