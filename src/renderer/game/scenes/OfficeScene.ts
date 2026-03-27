import Phaser from 'phaser'
import { TILE_SIZE, OFFICE_WIDTH, OFFICE_HEIGHT } from '../constants'
import { AgentCharacter } from '../entities/AgentCharacter'
import { gameBridge } from '../bridge'
import { t as getT } from '../../i18n'
import type { AgentRole, AgentStatus } from '../../../shared/types'
import type { Locale } from '../../i18n'

const GAME_FONT = "'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"
const W = OFFICE_WIDTH * TILE_SIZE   // 960
const H = OFFICE_HEIGHT * TILE_SIZE  // 640

const ZONES: Record<string, { x: number; y: number }> = {
  // Team Alpha (left side)
  'alpha-lead':    { x: 160, y: 200 },
  'alpha-senior':  { x: 160, y: 340 },
  'alpha-worker1': { x: 310, y: 200 },
  'alpha-worker2': { x: 310, y: 340 },

  // Team Beta (right side)
  'beta-lead':    { x: 610, y: 200 },
  'beta-senior':  { x: 610, y: 340 },
  'beta-worker1': { x: 760, y: 200 },
  'beta-worker2': { x: 760, y: 340 },

  // Shared
  ceo:      { x: 480, y: 500 },
  meeting:  { x: 480, y: 100 },
  lounge:   { x: 480, y: 400 },
  opsWall:  { x: 480, y: 56 },
}

const AGENT_ROLES = [
  'alpha-lead', 'alpha-senior', 'alpha-worker1', 'alpha-worker2',
  'beta-lead', 'beta-senior', 'beta-worker1', 'beta-worker2',
] as const

export class OfficeScene extends Phaser.Scene {
  private characters: Map<AgentRole, AgentCharacter> = new Map()
  private translatableTexts: { obj: Phaser.GameObjects.Text; key: string }[] = []
  private typingEmitters: Map<AgentRole, Phaser.GameObjects.Particles.ParticleEmitter> = new Map()
  private workstationHighlights: Map<AgentRole, Phaser.GameObjects.Rectangle> = new Map()
  private selectedAgent: AgentRole | null = null
  private roomTargets: Record<string, { x: number; y: number; zoom: number }> = {
    meeting: { x: ZONES.meeting.x, y: 100, zoom: 1.18 },
    'team-alpha': { x: 235, y: 270, zoom: 1.14 },
    'team-beta': { x: 685, y: 270, zoom: 1.14 },
    lounge: { x: ZONES.lounge.x, y: ZONES.lounge.y, zoom: 1.18 },
    executive: { x: 480, y: 500, zoom: 1.14 },
  }
  private isDraggingCamera = false
  private dragOrigin: { x: number; y: number; scrollX: number; scrollY: number } | null = null

  constructor() {
    super({ key: 'OfficeScene' })
  }

  create(): void {
    this.translatableTexts = []
    this.drawFloor()
    this.drawWalls()
    this.drawFurniture()
    this.createCharacters()
    this.addAmbientEffects()
    this.setupCameraControls()
    this.setupBridgeListeners()
  }

  // ===== Floor =====

  private drawFloor(): void {
    for (let y = 1; y < OFFICE_HEIGHT - 1; y++) {
      for (let x = 1; x < OFFICE_WIDTH - 1; x++) {
        this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 'floor')
      }
    }

    // Team Alpha carpet
    for (let y = 4; y < 13; y++) {
      for (let x = 3; x < 12; x++) {
        this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 'carpet').setDepth(0.45).setAlpha(0.55)
      }
    }

    // Team Beta carpet
    for (let y = 4; y < 13; y++) {
      for (let x = 17; x < 26; x++) {
        this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 'carpet').setDepth(0.45).setAlpha(0.45)
      }
    }

    // Meeting room carpet
    for (let y = 2; y < 5; y++) {
      for (let x = 12; x < 19; x++) {
        this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 'carpet').setDepth(0.5)
      }
    }

    // CEO area wood floor
    for (let y = 14; y < 18; y++) {
      for (let x = 12; x < 19; x++) {
        this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 'wood-floor').setDepth(0.5)
      }
    }

    if (this.textures.exists('rug')) {
      this.add.image(ZONES.meeting.x, ZONES.meeting.y + 24, 'rug').setDepth(0.6).setAlpha(0.7)
    }

    this.drawZoneFrames()
  }

  // ===== Walls =====

  private drawWalls(): void {
    for (let x = 0; x < OFFICE_WIDTH; x++) {
      this.add.image(x * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE / 2, 'wall').setDepth(1)
      this.add.image(x * TILE_SIZE + TILE_SIZE / 2, (OFFICE_HEIGHT - 1) * TILE_SIZE + TILE_SIZE / 2, 'wall').setDepth(1)
    }
    for (let y = 0; y < OFFICE_HEIGHT; y++) {
      this.add.image(TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 'wall').setDepth(1)
      this.add.image((OFFICE_WIDTH - 1) * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 'wall').setDepth(1)
    }

    if (this.textures.exists('window')) {
      for (const x of [160, 320, 640, 800]) {
        this.add.image(x, 30, 'window').setDepth(1.5).setAlpha(0.8)
      }
    }

    if (this.textures.exists('ceiling-light')) {
      for (const x of [200, 480, 760]) {
        this.add.image(x, 55, 'ceiling-light').setDepth(1.5)
        const cone = this.add.circle(x, 200, 80, 0xfef9c3, 0.015)
        cone.setDepth(0.3)
      }
    }
  }

  // ===== Furniture =====

  private drawFurniture(): void {
    this.drawMeetingPod()

    // Team Alpha workstations
    this.placeWorkstation(ZONES['alpha-lead'].x, ZONES['alpha-lead'].y, 'role.alpha-lead', '#60a5fa')
    this.placeWorkstation(ZONES['alpha-senior'].x, ZONES['alpha-senior'].y, 'role.alpha-senior', '#34d399')
    this.placeWorkstation(ZONES['alpha-worker1'].x, ZONES['alpha-worker1'].y, 'role.alpha-worker1', '#818cf8')
    this.placeWorkstation(ZONES['alpha-worker2'].x, ZONES['alpha-worker2'].y, 'role.alpha-worker2', '#a78bfa')

    // Team Beta workstations
    this.placeWorkstation(ZONES['beta-lead'].x, ZONES['beta-lead'].y, 'role.beta-lead', '#fb923c')
    this.placeWorkstation(ZONES['beta-senior'].x, ZONES['beta-senior'].y, 'role.beta-senior', '#fbbf24')
    this.placeWorkstation(ZONES['beta-worker1'].x, ZONES['beta-worker1'].y, 'role.beta-worker1', '#f472b6')
    this.placeWorkstation(ZONES['beta-worker2'].x, ZONES['beta-worker2'].y, 'role.beta-worker2', '#fb7185')

    // CEO workstation
    this.placeWorkstation(ZONES.ceo.x, ZONES.ceo.y, 'role.ceo', '#ff8c7a')

    this.drawOpsWall()
    this.drawLounge()
    this.drawTeamLabels()

    const plantPositions = [
      { x: 60, y: 80 }, { x: 900, y: 80 },
      { x: 60, y: 560 }, { x: 900, y: 560 },
      { x: 480, y: 560 },
      { x: 470, y: 265 },
    ]
    for (const p of plantPositions) {
      this.add.image(p.x, p.y, 'plant').setDepth(2)
    }

    this.add.image(132, 136, 'bookshelf').setDepth(2).setScale(0.82, 0.8)
    this.add.image(830, 136, 'bookshelf').setDepth(2).setScale(0.82, 0.8)

    this.add.text(W / 2, H - 14, 'AGENT OFFICE', {
      fontSize: '10px',
      color: '#1e293b',
      fontFamily: GAME_FONT,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1).setAlpha(0.35)

    this.addVignette()
  }

  private placeWorkstation(x: number, y: number, labelKey: string, color: string): void {
    this.add.image(x, y - 26, 'chair').setDepth(2)
    this.add.image(x, y, 'desk').setDepth(3)
    const highlight = this.add.rectangle(x, y + 6, 94, 66, 0x51bfad, 0.03)
    highlight.setDepth(1.8).setStrokeStyle(1, 0x51bfad, 0.08)
    this.workstationHighlights.set(this.labelKeyToRole(labelKey), highlight)
    this.tText(x, y + 24, labelKey, { fontSize: '8px', color, fontStyle: 'bold' }, 0.5, 4, 0.4)
  }

  // ===== Characters =====

  private createCharacters(): void {
    const configs: { role: AgentRole; nameKey: string; key: string; x: number; y: number }[] = AGENT_ROLES.map((role) => ({
      role,
      nameKey: `role.${role}`,
      key: `char-${role}`,
      x: ZONES[role].x,
      y: ZONES[role].y - 30,
    }))

    // CEO sprite (not an AgentCharacter)
    const ceo = this.add.sprite(ZONES.ceo.x, ZONES.ceo.y - 30, 'char-ceo').setDepth(10)
    this.tText(ZONES.ceo.x, ZONES.ceo.y - 6, 'game.ceo', {
      fontSize: '9px', color: '#f87171', fontStyle: 'bold',
      backgroundColor: '#0b112066', padding: { x: 6, y: 2 },
    }, 0.5, 11, 1)

    this.tweens.add({
      targets: ceo,
      y: ceo.y - 1.5,
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    for (const cfg of configs) {
      const char = new AgentCharacter(this, cfg.role, cfg.nameKey, cfg.key, { x: cfg.x, y: cfg.y })

      char.getSprite().on('pointerdown', () => {
        gameBridge.emit('character:clicked', cfg.role)
      })

      char.getSprite().on('pointerover', () => {
        gameBridge.emit('character:hover', cfg.role)
        char.setHighlight(true)
      })
      char.getSprite().on('pointerout', () => {
        gameBridge.emit('character:hover', null)
        char.setHighlight(false)
      })

      this.characters.set(cfg.role, char)
    }
  }

  // ===== Ambient Effects =====

  private addAmbientEffects(): void {
    if (this.textures.exists('particle')) {
      this.add.particles(0, 0, 'particle', {
        x: { min: 40, max: W - 40 },
        y: { min: 40, max: H - 40 },
        lifespan: 8000,
        speed: { min: 3, max: 10 },
        scale: { start: 0.6, end: 0 },
        alpha: { start: 0.25, end: 0 },
        frequency: 1000,
        blendMode: 'ADD',
      }).setDepth(0.2)
    }

    for (const role of AGENT_ROLES) {
      const zone = ZONES[role]
      const glow = this.add.circle(zone.x, zone.y - 5, 40, 0x51bfad, 0.025)
      glow.setDepth(2.5)
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.015, to: 0.04 },
        duration: 4000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 2000,
      })
    }

    // CEO glow
    const ceoGlow = this.add.circle(ZONES.ceo.x, ZONES.ceo.y - 5, 40, 0x51bfad, 0.025)
    ceoGlow.setDepth(2.5)
    this.tweens.add({
      targets: ceoGlow,
      alpha: { from: 0.015, to: 0.04 },
      duration: 4000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    if (this.textures.exists('typing-dots')) {
      for (const role of AGENT_ROLES) {
        const zone = ZONES[role]
        const emitter = this.add.particles(zone.x + 10, zone.y - 10, 'typing-dots', {
          lifespan: 600,
          speed: { min: 5, max: 15 },
          angle: { min: 240, max: 300 },
          scale: { start: 0.8, end: 0.2 },
          alpha: { start: 0.7, end: 0 },
          frequency: 300,
          blendMode: 'ADD',
          emitting: false,
        })
        emitter.setDepth(12)
        this.typingEmitters.set(role, emitter)
      }
    }
  }

  private addVignette(): void {
    for (const [x, y, w, h, a] of [
      [W / 2, 0, W, 60, 0.45],
      [W / 2, H, W, 60, 0.45],
      [0, H / 2, 50, H, 0.3],
      [W, H / 2, 50, H, 0.3],
    ] as [number, number, number, number, number][]) {
      const rect = this.add.rectangle(x, y, w, h, 0x06090f)
      rect.setOrigin(x === 0 ? 0 : x === W ? 1 : 0.5, y === 0 ? 0 : y === H ? 1 : 0.5)
      rect.setDepth(0.4).setAlpha(a)
    }
  }

  private drawZoneFrames(): void {
    // Team Alpha zone
    this.add.rectangle(235, 270, 340, 240, 0x3b82f6, 0.025).setDepth(0.58).setStrokeStyle(2, 0x3b82f6, 0.14)
    // Team Beta zone
    this.add.rectangle(685, 270, 340, 240, 0xf97316, 0.025).setDepth(0.58).setStrokeStyle(2, 0xf97316, 0.14)
    // Meeting room
    this.add.rectangle(ZONES.meeting.x, 100, 220, 100, 0x7dd3c8, 0.03).setDepth(0.58).setStrokeStyle(2, 0x7dd3c8, 0.18)
    // CEO area
    this.add.rectangle(480, 500, 200, 140, 0xffb86b, 0.03).setDepth(0.58).setStrokeStyle(2, 0xffb86b, 0.14)
  }

  private drawTeamLabels(): void {
    this.tText(235, 150, 'team.alpha', { fontSize: '10px', color: '#60a5fa', fontStyle: 'bold' }, 0.5, 4, 0.5)
    this.tText(685, 150, 'team.beta', { fontSize: '10px', color: '#fb923c', fontStyle: 'bold' }, 0.5, 4, 0.5)
  }

  private drawMeetingPod(): void {
    this.add.image(ZONES.meeting.x, 56, 'whiteboard').setDepth(2)
    this.tText(ZONES.meeting.x, 80, 'game.meetingRoom', { fontSize: '9px', color: '#86cfc2', fontStyle: 'bold' })
    this.add.rectangle(ZONES.meeting.x, 115, 126, 28, 0x2b3f4b, 0.96).setDepth(2.1).setStrokeStyle(2, 0x4c6976, 0.7)
    for (const chairX of [-60, -22, 22, 60]) {
      this.add.image(ZONES.meeting.x + chairX, 135, 'chair').setDepth(2)
    }
  }

  private createRoomHotspot(x: number, y: number, width: number, height: number, roomId: string, label: string): void {
    const zone = this.add.zone(x, y, width, height)
    zone.setRectangleDropZone(width, height)
    zone.setInteractive({ useHandCursor: true })
    zone.setDepth(1.7)
    zone.on('pointerover', () => gameBridge.emit('room:hover', roomId, label))
    zone.on('pointerout', () => gameBridge.emit('room:hover', null))
    zone.on('pointerdown', () => {
      this.selectedAgent = null
      this.updateSelectionFocus()
      this.focusRoom(roomId)
      gameBridge.emit('room:clicked', roomId)
    })
  }

  private drawOpsWall(): void {
    this.add.image(ZONES.opsWall.x - 50, 56, 'whiteboard').setDepth(2).setScale(0.84, 0.8)
    this.add.image(ZONES.opsWall.x + 50, 56, 'whiteboard').setDepth(2).setScale(0.84, 0.8)
  }

  private drawLounge(): void {
    this.add.image(ZONES.lounge.x - 16, ZONES.lounge.y - 6, 'coffeemaker').setDepth(2)
    this.add.image(ZONES.lounge.x + 18, ZONES.lounge.y - 6, 'water-cooler').setDepth(2)
    this.add.circle(ZONES.lounge.x, ZONES.lounge.y + 26, 22, 0x224754, 0.95).setDepth(1.9).setStrokeStyle(2, 0x40626c, 0.8)
    this.tText(ZONES.lounge.x, ZONES.lounge.y + 56, 'game.coffee', { fontSize: '8px', color: '#8faea7' })

    // Room hotspots
    this.createRoomHotspot(480, 500, 200, 140, 'executive', 'Executive corner')
    this.createRoomHotspot(ZONES.meeting.x, 100, 220, 100, 'meeting', 'War room')
    this.createRoomHotspot(235, 270, 340, 240, 'team-alpha', 'Team Alpha bay')
    this.createRoomHotspot(685, 270, 340, 240, 'team-beta', 'Team Beta bay')
    this.createRoomHotspot(ZONES.lounge.x, ZONES.lounge.y + 12, 128, 116, 'lounge', 'Coffee lounge')
  }

  // ===== Bridge Listeners =====

  private setupBridgeListeners(): void {
    gameBridge.on('agent:state-changed', (role: AgentRole, status: AgentStatus, action?: string) => {
      const char = this.characters.get(role)
      if (char) char.setStatus(status, action)

      const emitter = this.typingEmitters.get(role)
      if (emitter) {
        emitter.emitting = (status === 'working')
        if (char) {
          const sprite = char.getSprite()
          emitter.setPosition(sprite.x + 10, sprite.y - 10)
        }
      }
    })

    gameBridge.on('locale:changed', (_locale: Locale) => {
      this.updateAllTexts()
    })

    gameBridge.on('agent:selected', (role: AgentRole | null) => {
      this.selectedAgent = role
      this.updateSelectionFocus()
    })
  }

  // ===== i18n Helpers =====

  private tText(
    x: number, y: number, key: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
    origin = 0.5, depth = 4, alpha = 0.7
  ): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, getT(key as any), { fontFamily: GAME_FONT, ...style })
    text.setOrigin(origin).setDepth(depth).setAlpha(alpha)
    this.translatableTexts.push({ obj: text, key })
    return text
  }

  private updateAllTexts(): void {
    for (const entry of this.translatableTexts) {
      if (entry.obj?.active) entry.obj.setText(getT(entry.key as any))
    }
    for (const char of this.characters.values()) char.updateLocale()
  }

  private updateSelectionFocus(): void {
    const camera = this.cameras.main

    for (const [role, char] of this.characters.entries()) {
      char.setFocus(role === this.selectedAgent)
    }

    for (const [role, rect] of this.workstationHighlights.entries()) {
      const active = role === this.selectedAgent
      this.tweens.add({
        targets: rect,
        alpha: active ? 1 : 0.2,
        scaleX: active ? 1.08 : 1,
        scaleY: active ? 1.08 : 1,
        duration: 220,
        ease: 'Power2',
      })
      rect.setStrokeStyle(active ? 2 : 1, active ? 0x51bfad : 0x51bfad, active ? 0.35 : 0.08)
    }

    if (!this.selectedAgent) {
      camera.pan(W / 2, H / 2, 280, 'Sine.easeOut')
      camera.zoomTo(1, 280)
      return
    }

    const selected = this.characters.get(this.selectedAgent)
    if (!selected) return

    const sprite = selected.getSprite()
    camera.pan(sprite.x, sprite.y, 320, 'Sine.easeOut')
    camera.zoomTo(1.08, 320)
  }

  private focusRoom(roomId: string): void {
    const target = this.roomTargets[roomId]
    if (!target) return
    this.cameras.main.pan(target.x, target.y, 320, 'Sine.easeOut')
    this.cameras.main.zoomTo(target.zoom, 320)
  }

  private setupCameraControls(): void {
    const camera = this.cameras.main
    camera.setBounds(0, 0, W, H)

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _go: unknown, _dx: number, dy: number) => {
      const nextZoom = Phaser.Math.Clamp(camera.zoom - dy * 0.001, 1, 1.4)
      camera.zoomTo(nextZoom, 120)
    })

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() || pointer.middleButtonDown()) return
      if ((pointer.event.target as HTMLElement | null)?.tagName === 'CANVAS') {
        this.isDraggingCamera = true
        this.dragOrigin = { x: pointer.x, y: pointer.y, scrollX: camera.scrollX, scrollY: camera.scrollY }
      }
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDraggingCamera || !this.dragOrigin || !pointer.isDown || camera.zoom <= 1.01) return
      const dx = (pointer.x - this.dragOrigin.x) / camera.zoom
      const dy = (pointer.y - this.dragOrigin.y) / camera.zoom
      camera.setScroll(this.dragOrigin.scrollX - dx, this.dragOrigin.scrollY - dy)
    })

    this.input.on('pointerup', () => {
      this.isDraggingCamera = false
      this.dragOrigin = null
    })
  }

  private labelKeyToRole(labelKey: string): AgentRole {
    // Extract role from label key like 'role.alpha-lead' -> 'alpha-lead'
    const parts = labelKey.split('.')
    return parts[parts.length - 1] || labelKey
  }
}
