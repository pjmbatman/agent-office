import EventEmitter from 'eventemitter3'
import type { AgentRole, AgentStatus } from '../../shared/types'
import type { Locale } from '../i18n'

/**
 * Shared event bus between React and Phaser.
 * React dispatches state changes; Phaser listens and updates sprites.
 * Phaser dispatches user interactions; React listens and updates panels.
 */

interface BridgeEvents {
  // React → Phaser
  'agent:state-changed': (role: AgentRole, status: AgentStatus, action?: string) => void
  'agent:selected': (role: AgentRole | null) => void
  'task:state-changed': (state: string) => void
  'locale:changed': (locale: Locale) => void

  // Phaser → React
  'character:clicked': (role: AgentRole) => void
  'character:hover': (role: AgentRole | null) => void
  'room:clicked': (roomId: string) => void
  'room:hover': (roomId: string | null, label?: string) => void
}

class GameBridge extends EventEmitter<BridgeEvents> {}

export const gameBridge = new GameBridge()
