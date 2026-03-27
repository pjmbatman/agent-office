import Phaser from 'phaser'
import { gameBridge } from '../bridge'
import type { AgentRole, AgentStatus } from '../../../shared/types'

const GAME_FONT = "'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"

interface SpeechBubbleData {
  container: Phaser.GameObjects.Container
  text: Phaser.GameObjects.Text
  bg: Phaser.GameObjects.Sprite
}

interface AgentSnapshot {
  status: AgentStatus
  action?: string
}

export class UIOverlayScene extends Phaser.Scene {
  private bubbles: Map<AgentRole, SpeechBubbleData> = new Map()
  private bubbleTimers: Map<AgentRole, Phaser.Time.TimerEvent> = new Map()
  private agentSnapshots: Map<AgentRole, AgentSnapshot> = new Map()
  private selectedAgent: AgentRole | null = null
  private roomHoverLabel: Phaser.GameObjects.Container | null = null
  private selectedCard: Phaser.GameObjects.Container | null = null

  private charPositions: Record<AgentRole, { x: number; y: number }> = {
    teamlead: { x: 236, y: 226 },
    senior: { x: 236, y: 382 },
    junior: { x: 690, y: 274 },
  }

  constructor() {
    super({ key: 'UIOverlayScene' })
  }

  create(): void {
    this.scene.bringToTop()
    this.setupBridgeListeners()
  }

  showBubble(role: AgentRole, text: string, duration = 4000): void {
    this.hideBubble(role)

    const pos = this.charPositions[role]
    if (!pos) return

    const bg = this.add.sprite(0, 0, 'speech-bubble')
    bg.setOrigin(0.5, 1)

    const bubbleText = this.add.text(0, -24, text.slice(0, 50) + (text.length > 50 ? '...' : ''), {
      fontSize: '9px',
      color: '#e2e8f0',
      wordWrap: { width: 124 },
      lineSpacing: 2,
      fontFamily: GAME_FONT,
    })
    bubbleText.setOrigin(0.5, 0.5)

    const container = this.add.container(pos.x, pos.y - 50, [bg, bubbleText])
    container.setDepth(100)
    container.setScale(0.6)
    container.setAlpha(0)

    this.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: 250,
      ease: 'Back.easeOut',
    })

    this.bubbles.set(role, { container, text: bubbleText, bg })

    const timer = this.time.delayedCall(duration, () => {
      this.hideBubble(role)
    })
    this.bubbleTimers.set(role, timer)
  }

  hideBubble(role: AgentRole): void {
    const bubble = this.bubbles.get(role)
    if (bubble) {
      this.tweens.add({
        targets: bubble.container,
        alpha: 0,
        scale: 0.7,
        y: bubble.container.y - 8,
        duration: 180,
        ease: 'Power2',
        onComplete: () => bubble.container.destroy(),
      })
      this.bubbles.delete(role)
    }

    const timer = this.bubbleTimers.get(role)
    if (timer) {
      timer.remove()
      this.bubbleTimers.delete(role)
    }
  }

  private setupBridgeListeners(): void {
    gameBridge.on('agent:state-changed', (role: AgentRole, status: AgentStatus, action?: string) => {
      this.agentSnapshots.set(role, { status, action })
      if (action && status !== 'idle') {
        this.showBubble(role, action)
      }
      if (status === 'idle') {
        this.hideBubble(role)
      }
      if (this.selectedAgent === role) {
        this.renderSelectedCard()
      }
    })

    gameBridge.on('agent:selected', (role: AgentRole | null) => {
      this.selectedAgent = role
      this.renderSelectedCard()
    })

    gameBridge.on('room:hover', (_roomId: string | null, label?: string) => {
      this.renderRoomHover(label || null)
    })
  }

  private renderSelectedCard(): void {
    this.selectedCard?.destroy()
    this.selectedCard = null

    if (!this.selectedAgent) return

    const snapshot = this.agentSnapshots.get(this.selectedAgent)
    const bg = this.add.rectangle(0, 0, 250, 92, 0x0c1c23, 0.92).setStrokeStyle(1, 0x51bfad, 0.24)
    const role = this.add.text(-108, -26, this.selectedAgent.toUpperCase(), {
      fontFamily: GAME_FONT,
      fontSize: '14px',
      color: '#ecf5f2',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5)
    const status = this.add.text(-108, -2, snapshot?.status || 'idle', {
      fontFamily: GAME_FONT,
      fontSize: '11px',
      color: '#68d2c0',
    }).setOrigin(0, 0.5)
    const action = this.add.text(-108, 22, snapshot?.action || 'Waiting for assignment', {
      fontFamily: GAME_FONT,
      fontSize: '11px',
      color: '#a2bbb4',
      wordWrap: { width: 190 },
      lineSpacing: 2,
    }).setOrigin(0, 0.5)

    const container = this.add.container(158, 92, [bg, role, status, action])
    container.setDepth(140)
    container.setAlpha(0)
    container.setScale(0.94)
    this.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: 180,
      ease: 'Power2',
    })
    this.selectedCard = container
  }

  private renderRoomHover(label: string | null): void {
    this.roomHoverLabel?.destroy()
    this.roomHoverLabel = null
    if (!label) return

    const bg = this.add.rectangle(0, 0, 132, 28, 0x0c1c23, 0.84).setStrokeStyle(1, 0x8faea7, 0.18)
    const text = this.add.text(0, 0, label, {
      fontFamily: GAME_FONT,
      fontSize: '11px',
      color: '#dbe8e4',
    }).setOrigin(0.5)

    const container = this.add.container(480, 32, [bg, text])
    container.setDepth(150)
    this.roomHoverLabel = container
  }
}
