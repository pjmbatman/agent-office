import Phaser from 'phaser'
import { t as getT } from '../../i18n'
import type { AgentRole, AgentStatus } from '../../../shared/types'

type CharacterState = 'sitting' | 'standing' | 'walking' | 'working' | 'talking'

interface DeskPosition { x: number; y: number }

const GAME_FONT = "'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"

const ROLE_LABEL_COLORS: Record<string, string> = {
  'alpha-lead': '#60a5fa',
  'alpha-senior': '#34d399',
  'alpha-worker1': '#818cf8',
  'alpha-worker2': '#a78bfa',
  'beta-lead': '#fb923c',
  'beta-senior': '#fbbf24',
  'beta-worker1': '#f472b6',
  'beta-worker2': '#fb7185',
  teamlead: '#60a5fa',
  senior: '#34d399',
  junior: '#fbbf24',
}

export class AgentCharacter {
  private scene: Phaser.Scene
  private sprite: Phaser.GameObjects.Sprite
  private statusIcon: Phaser.GameObjects.Sprite | null = null
  private nameText: Phaser.GameObjects.Text
  private hoverRing: Phaser.GameObjects.Sprite | null = null
  private focusGlow: Phaser.GameObjects.Ellipse | null = null
  private state: CharacterState = 'sitting'
  private _agentStatus: AgentStatus = 'idle'
  private moveTween: Phaser.Tweens.Tween | null = null
  private nameKey: string

  readonly role: AgentRole
  readonly deskPos: DeskPosition
  readonly spriteKey: string

  private meetingPos = { x: 480, y: 100 }

  constructor(
    scene: Phaser.Scene,
    role: AgentRole,
    nameKey: string,
    spriteKey: string,
    deskPos: DeskPosition
  ) {
    this.scene = scene
    this.role = role
    this.nameKey = nameKey
    this.spriteKey = spriteKey
    this.deskPos = deskPos

    // Sprite
    this.sprite = scene.add.sprite(deskPos.x, deskPos.y, spriteKey)
    this.sprite.setInteractive({ useHandCursor: true })
    this.sprite.setDepth(10)

    // Name label
    const labelColor = ROLE_LABEL_COLORS[role] || '#94a3b8'
    this.nameText = scene.add.text(deskPos.x, deskPos.y + 24, getT(nameKey as any), {
      fontSize: '9px',
      color: labelColor,
      fontFamily: GAME_FONT,
      fontStyle: 'bold',
      backgroundColor: '#0b112066',
      padding: { x: 6, y: 2 },
    })
    this.nameText.setOrigin(0.5).setDepth(11)

    // Hover ring (hidden by default)
    if (scene.textures.exists('hover-ring')) {
      this.hoverRing = scene.add.sprite(deskPos.x, deskPos.y, 'hover-ring')
      this.hoverRing.setDepth(9).setAlpha(0).setScale(0.8)
    }

    this.focusGlow = scene.add.ellipse(deskPos.x, deskPos.y + 6, 84, 52, 0x51bfad, 0.08)
    this.focusGlow.setDepth(8.5).setStrokeStyle(2, 0x51bfad, 0.22).setAlpha(0)

    // Idle breathing
    this.startIdleAnimation()
  }

  get agentStatus(): AgentStatus {
    return this._agentStatus
  }

  updateLocale(): void {
    this.nameText.setText(getT(this.nameKey as any))
  }

  setHighlight(on: boolean): void {
    if (!this.hoverRing) return
    this.scene.tweens.add({
      targets: this.hoverRing,
      alpha: on ? 0.4 : 0,
      scale: on ? 1 : 0.8,
      duration: 200,
      ease: 'Power2',
    })
  }

  setFocus(on: boolean): void {
    if (!this.focusGlow) return

    this.scene.tweens.add({
      targets: this.focusGlow,
      alpha: on ? 1 : 0,
      scaleX: on ? 1.08 : 0.92,
      scaleY: on ? 1.08 : 0.92,
      duration: 220,
      ease: 'Power2',
    })

    this.scene.tweens.add({
      targets: this.nameText,
      alpha: on ? 1 : 0.95,
      scale: on ? 1.08 : 1,
      duration: 220,
      ease: 'Power2',
    })
  }

  setStatus(status: AgentStatus, _action?: string): void {
    this._agentStatus = status

    // Remove old status icon
    if (this.statusIcon) {
      this.statusIcon.destroy()
      this.statusIcon = null
    }

    switch (status) {
      case 'thinking':
        this.showStatusIcon('icon-thinking')
        this.walkTo(this.getMeetingOffset(), () => this.setState('talking'))
        break
      case 'working':
        this.showStatusIcon('icon-working')
        this.walkTo(this.deskPos, () => this.setState('working'))
        break
      case 'done':
        this.showStatusIcon('icon-done')
        this.setState('standing')
        this.scene.time.delayedCall(2500, () => {
          if (this._agentStatus === 'done' && this.statusIcon) {
            this.scene.tweens.add({
              targets: this.statusIcon,
              alpha: 0, scale: 0.3,
              duration: 400,
              onComplete: () => { this.statusIcon?.destroy(); this.statusIcon = null },
            })
          }
        })
        break
      case 'error':
        this.showStatusIcon('icon-error')
        // Shake
        this.scene.tweens.add({
          targets: this.sprite,
          x: this.sprite.x + 4,
          duration: 50,
          yoyo: true,
          repeat: 4,
          ease: 'Sine.easeInOut',
        })
        break
      case 'idle':
        this.walkTo(this.deskPos, () => this.setState('sitting'))
        break
    }
  }

  getSprite(): Phaser.GameObjects.Sprite {
    return this.sprite
  }

  destroy(): void {
    this.sprite.destroy()
    this.nameText.destroy()
    this.hoverRing?.destroy()
    this.focusGlow?.destroy()
    this.statusIcon?.destroy()
  }

  // ===== Private =====

  private setState(state: CharacterState): void {
    this.state = state
  }

  private getMeetingOffset(): DeskPosition {
    const offsets: Record<string, number> = {
      'alpha-lead': -90, 'alpha-senior': -60, 'alpha-worker1': -30, 'alpha-worker2': 0,
      'beta-lead': 30, 'beta-senior': 60, 'beta-worker1': 90, 'beta-worker2': 120,
    }
    const offset = offsets[this.role] ?? 0
    return { x: this.meetingPos.x + offset, y: this.meetingPos.y }
  }

  private showStatusIcon(key: string): void {
    this.statusIcon = this.scene.add.sprite(
      this.sprite.x, this.sprite.y - 30, key
    ).setDepth(12)

    // Pop-in
    this.statusIcon.setScale(0)
    this.scene.tweens.add({
      targets: this.statusIcon,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
    })

    // Float
    this.scene.tweens.add({
      targets: this.statusIcon,
      y: this.statusIcon.y - 5,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 300,
    })
  }

  private walkTo(target: DeskPosition, onComplete: () => void): void {
    // Cancel any existing move tween
    if (this.moveTween && this.moveTween.isPlaying()) {
      this.moveTween.stop()
    }

    this.setState('walking')
    this.moveTween = this.scene.tweens.add({
      targets: this.sprite,
      x: target.x,
      y: target.y,
      duration: 1000,
      ease: 'Cubic.easeInOut',
      onUpdate: () => {
        this.nameText.setPosition(this.sprite.x, this.sprite.y + 24)
        this.hoverRing?.setPosition(this.sprite.x, this.sprite.y)
        this.focusGlow?.setPosition(this.sprite.x, this.sprite.y + 6)
        if (this.statusIcon) {
          this.statusIcon.setPosition(this.sprite.x, this.sprite.y - 30)
        }
      },
      onComplete,
    })
  }

  private startIdleAnimation(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - 1.5,
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }
}
