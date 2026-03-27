import Phaser from 'phaser'
import { TILE_SIZE } from '../constants'

/**
 * BootScene: Generate polished procedural sprites/textures.
 * Reference style: modern pixel-art office (Stardew Valley meets tech office)
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  create(): void {
    // Floor & walls
    this.generateFloorTile()
    this.generateWallTile()
    this.generateCarpetTile()
    this.generateWoodFloor()
    this.generateWindowTile()

    // Characters — Team Alpha (blue tones)
    this.generateCharacterSprite('char-alpha-lead', 0x60a5fa, 0x3b82f6, 0x4b3621)
    this.generateCharacterSprite('char-alpha-senior', 0x34d399, 0x10b981, 0x2c1a0e)
    this.generateCharacterSprite('char-alpha-worker1', 0x818cf8, 0x6366f1, 0x3b2d20)
    this.generateCharacterSprite('char-alpha-worker2', 0xa78bfa, 0x8b5cf6, 0x352a1e)
    // Characters — Team Beta (warm tones)
    this.generateCharacterSprite('char-beta-lead', 0xfb923c, 0xf97316, 0x2c1a0e)
    this.generateCharacterSprite('char-beta-senior', 0xfbbf24, 0xf59e0b, 0x5c3a1e)
    this.generateCharacterSprite('char-beta-worker1', 0xf472b6, 0xec4899, 0x3b1a2e)
    this.generateCharacterSprite('char-beta-worker2', 0xfb7185, 0xf43f5e, 0x3a1520)
    // CEO
    this.generateCharacterSprite('char-ceo', 0xf87171, 0xef4444, 0x1a1a2e)

    // Status icons
    this.generateStatusIcon('icon-thinking', 0xf59e0b)
    this.generateStatusIcon('icon-working', 0x3b82f6)
    this.generateStatusIcon('icon-done', 0x10b981)
    this.generateStatusIcon('icon-error', 0xef4444)

    // Furniture
    this.generateDesk()
    this.generateWhiteboard()
    this.generatePlant()
    this.generateBookshelf()
    this.generateCoffeeMachine()
    this.generateChair()
    this.generateCeilingLight()
    this.generateWaterCooler()
    this.generateRug()

    // Effects
    this.generateSpeechBubble()
    this.generateParticle()
    this.generateHoverRing()
    this.generateTypingDots()

    this.scene.start('OfficeScene')
    this.scene.launch('UIOverlayScene')
  }

  // ===== Floor & Walls =====

  private generateFloorTile(): void {
    const g = this.g()
    g.fillStyle(0x1a2538)
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
    g.fillStyle(0x1e2b40)
    g.fillRect(1, 1, TILE_SIZE - 2, TILE_SIZE - 2)
    // Subtle grid
    g.fillStyle(0x22304a, 0.5)
    g.fillRect(0, 0, TILE_SIZE, 1)
    g.fillRect(0, 0, 1, TILE_SIZE)
    g.generateTexture('floor', TILE_SIZE, TILE_SIZE)
    g.destroy()
  }

  private generateWallTile(): void {
    const g = this.g()
    g.fillStyle(0x0d1525)
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
    // Baseboard
    g.fillStyle(0x162032)
    g.fillRect(0, TILE_SIZE - 4, TILE_SIZE, 4)
    // Top molding
    g.fillStyle(0x172540, 0.8)
    g.fillRect(0, 0, TILE_SIZE, 2)
    g.generateTexture('wall', TILE_SIZE, TILE_SIZE)
    g.destroy()
  }

  private generateCarpetTile(): void {
    const g = this.g()
    g.fillStyle(0x1a2744)
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
    // Subtle carpet weave
    for (let i = 0; i < 6; i++) {
      g.fillStyle(0x1e2d4f, 0.6)
      g.fillRect((i * 7 + 2) % TILE_SIZE, (i * 11 + 3) % TILE_SIZE, 2, 1)
    }
    g.generateTexture('carpet', TILE_SIZE, TILE_SIZE)
    g.destroy()
  }

  private generateWoodFloor(): void {
    const g = this.g()
    g.fillStyle(0x2a1f14)
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
    g.fillStyle(0x31241a)
    g.fillRect(1, 0, TILE_SIZE - 2, TILE_SIZE)
    // Wood grain lines
    g.fillStyle(0x382a1e, 0.7)
    g.fillRect(0, 8, TILE_SIZE, 1)
    g.fillRect(0, 22, TILE_SIZE, 1)
    g.generateTexture('wood-floor', TILE_SIZE, TILE_SIZE)
    g.destroy()
  }

  private generateWindowTile(): void {
    const w = 40
    const h = 52
    const g = this.g()
    // Frame
    g.fillStyle(0x374151)
    g.fillRoundedRect(0, 0, w, h, 2)
    // Glass panes (sky blue glow)
    g.fillStyle(0x1e3a5f, 0.9)
    g.fillRect(3, 3, w - 6, h / 2 - 4)
    g.fillRect(3, h / 2 + 1, w - 6, h / 2 - 4)
    // Glow effect
    g.fillStyle(0x38bdf8, 0.06)
    g.fillRect(2, 2, w - 4, h - 4)
    // Center divider
    g.fillStyle(0x4b5563)
    g.fillRect(0, h / 2 - 1, w, 2)
    g.fillRect(w / 2 - 1, 0, 2, h)
    g.generateTexture('window', w, h)
    g.destroy()
  }

  // ===== Characters =====

  private generateCharacterSprite(key: string, bodyColor: number, darkColor: number, hairColor: number): void {
    const w = 28
    const h = 38
    const g = this.g()

    // Shadow
    g.fillStyle(0x000000, 0.2)
    g.fillEllipse(14, 36, 20, 6)

    // Legs
    g.fillStyle(0x2c3e50)
    g.fillRoundedRect(8, 28, 5, 8, 2)
    g.fillRoundedRect(15, 28, 5, 8, 2)

    // Body
    g.fillStyle(darkColor)
    g.fillRoundedRect(5, 14, 18, 16, 5)
    g.fillStyle(bodyColor)
    g.fillRoundedRect(6, 14, 16, 14, 4)

    // Collar/tie accent
    g.fillStyle(0xffffff, 0.2)
    g.fillRect(12, 14, 4, 3)

    // Arms
    g.fillStyle(bodyColor, 0.9)
    g.fillRoundedRect(2, 16, 5, 12, 2)
    g.fillRoundedRect(21, 16, 5, 12, 2)
    // Hands
    g.fillStyle(0xfdd9b5)
    g.fillCircle(4, 28, 2.5)
    g.fillCircle(24, 28, 2.5)

    // Head
    g.fillStyle(0xfdd9b5)
    g.fillCircle(14, 9, 8)

    // Hair
    g.fillStyle(hairColor)
    g.fillEllipse(14, 4, 16, 8)
    // Side hair
    g.fillStyle(hairColor, 0.8)
    g.fillRect(5, 4, 3, 6)
    g.fillRect(20, 4, 3, 6)

    // Eyes
    g.fillStyle(0x1e293b)
    g.fillCircle(11, 9, 1.8)
    g.fillCircle(17, 9, 1.8)
    // Eye highlights
    g.fillStyle(0xffffff)
    g.fillCircle(11.7, 8.3, 0.7)
    g.fillCircle(17.7, 8.3, 0.7)

    // Eyebrows
    g.fillStyle(hairColor, 0.7)
    g.fillRect(9, 6, 4, 1)
    g.fillRect(15, 6, 4, 1)

    // Mouth
    g.fillStyle(0xe8a088, 0.6)
    g.fillRoundedRect(12, 12, 4, 1.5, 1)

    g.generateTexture(key, w, h)
    g.destroy()
  }

  // ===== Status Icons =====

  private generateStatusIcon(key: string, color: number): void {
    const size = 20
    const g = this.g()
    // Glow
    g.fillStyle(color, 0.15)
    g.fillCircle(size / 2, size / 2, size / 2)
    // Ring
    g.lineStyle(2, color, 0.6)
    g.strokeCircle(size / 2, size / 2, size / 2 - 2)
    // Inner dot
    g.fillStyle(color, 0.95)
    g.fillCircle(size / 2, size / 2, size / 2 - 4)
    // Highlight
    g.fillStyle(0xffffff, 0.35)
    g.fillCircle(size / 2 - 1, size / 2 - 1, 2)
    g.generateTexture(key, size, size)
    g.destroy()
  }

  // ===== Furniture =====

  private generateDesk(): void {
    const w = 68
    const h = 40
    const g = this.g()

    // Shadow
    g.fillStyle(0x000000, 0.12)
    g.fillRoundedRect(4, 4, w, h, 3)

    // Desk legs
    g.fillStyle(0x4b5563)
    g.fillRect(6, h - 6, 3, 6)
    g.fillRect(w - 9, h - 6, 3, 6)

    // Desk surface
    g.fillStyle(0x374151)
    g.fillRoundedRect(0, 0, w, h - 4, 3)
    g.fillStyle(0x4b5563)
    g.fillRoundedRect(2, 2, w - 4, h - 10, 2)

    // Monitor
    g.fillStyle(0x111827)
    g.fillRoundedRect(20, 3, 28, 18, 2)
    // Screen content
    g.fillStyle(0x0ea5e9, 0.12)
    g.fillRoundedRect(22, 5, 24, 14, 1)
    // Code lines on screen
    g.fillStyle(0x38bdf8, 0.15)
    g.fillRect(24, 7, 14, 1)
    g.fillStyle(0x34d399, 0.12)
    g.fillRect(24, 10, 10, 1)
    g.fillStyle(0xfbbf24, 0.1)
    g.fillRect(24, 13, 16, 1)
    // Monitor stand
    g.fillStyle(0x4b5563)
    g.fillRect(32, 21, 4, 4)
    g.fillRect(29, 24, 10, 2)
    // Monitor glow
    g.fillStyle(0x0ea5e9, 0.04)
    g.fillCircle(34, 12, 20)

    // Keyboard
    g.fillStyle(0x374151)
    g.fillRoundedRect(22, 27, 22, 6, 1)
    g.fillStyle(0x4b5563, 0.5)
    for (let i = 0; i < 4; i++) {
      g.fillRect(24 + i * 5, 28, 3, 1)
      g.fillRect(24 + i * 5, 31, 3, 1)
    }

    // Mouse
    g.fillStyle(0x374151)
    g.fillRoundedRect(48, 28, 6, 4, 2)

    // Coffee mug
    g.fillStyle(0xffffff, 0.3)
    g.fillRoundedRect(8, 27, 6, 6, 2)
    g.fillStyle(0x7c3aed, 0.3)
    g.fillRect(9, 28, 4, 4)

    g.generateTexture('desk', w, h)
    g.destroy()
  }

  private generateWhiteboard(): void {
    const w = 100
    const h = 60
    const g = this.g()

    // Frame shadow
    g.fillStyle(0x000000, 0.15)
    g.fillRoundedRect(3, 3, w, h, 4)
    // Frame
    g.fillStyle(0x4b5563)
    g.fillRoundedRect(0, 0, w, h, 4)
    // Board surface
    g.fillStyle(0xf1f5f9, 0.92)
    g.fillRoundedRect(4, 4, w - 8, h - 8, 2)

    // Fake content (wireframe/planning)
    g.fillStyle(0x3b82f6, 0.2)
    g.fillRoundedRect(10, 10, 30, 14, 2)
    g.fillStyle(0x10b981, 0.2)
    g.fillRoundedRect(44, 10, 22, 14, 2)
    g.fillStyle(0xf59e0b, 0.2)
    g.fillRoundedRect(70, 10, 22, 14, 2)
    // Arrows
    g.fillStyle(0x94a3b8, 0.3)
    g.fillRect(40, 16, 4, 2)
    g.fillRect(66, 16, 4, 2)
    // Bottom text lines
    g.fillStyle(0x64748b, 0.2)
    g.fillRect(10, 30, 50, 2)
    g.fillRect(10, 36, 35, 2)
    g.fillRect(10, 42, 45, 2)

    // Markers at bottom
    g.fillStyle(0xef4444, 0.6)
    g.fillRoundedRect(76, h - 10, 4, 8, 1)
    g.fillStyle(0x3b82f6, 0.6)
    g.fillRoundedRect(82, h - 10, 4, 8, 1)
    g.fillStyle(0x10b981, 0.6)
    g.fillRoundedRect(88, h - 10, 4, 8, 1)

    g.generateTexture('whiteboard', w, h)
    g.destroy()
  }

  private generatePlant(): void {
    const w = 22
    const h = 34
    const g = this.g()

    // Pot
    g.fillStyle(0x6b7280)
    g.fillRoundedRect(4, 20, 14, 14, 3)
    g.fillStyle(0x7c8390)
    g.fillRoundedRect(3, 19, 16, 4, 2)
    // Soil
    g.fillStyle(0x4a3728)
    g.fillRect(6, 20, 10, 3)

    // Leaves (layered for depth)
    g.fillStyle(0x15803d, 0.8)
    g.fillCircle(11, 14, 7)
    g.fillStyle(0x22c55e, 0.85)
    g.fillCircle(8, 11, 5)
    g.fillCircle(14, 11, 5)
    g.fillStyle(0x4ade80, 0.6)
    g.fillCircle(11, 8, 4)
    g.fillCircle(6, 14, 3)
    g.fillCircle(16, 13, 3)

    // Stem
    g.fillStyle(0x166534)
    g.fillRect(10, 14, 2, 7)

    g.generateTexture('plant', w, h)
    g.destroy()
  }

  private generateBookshelf(): void {
    const w = 56
    const h = 44
    const g = this.g()

    g.fillStyle(0x000000, 0.1)
    g.fillRoundedRect(2, 2, w, h, 2)
    g.fillStyle(0x4a3728)
    g.fillRoundedRect(0, 0, w, h, 2)
    // Inner
    g.fillStyle(0x3b2d20)
    g.fillRect(2, 2, w - 4, h - 4)

    // Shelves
    g.fillStyle(0x5c4535)
    g.fillRect(2, 20, w - 4, 2)

    // Books (top shelf) - colorful spines
    const topColors = [0x3b82f6, 0xef4444, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899]
    for (let i = 0; i < 6; i++) {
      const bw = 5 + (i % 2)
      g.fillStyle(topColors[i], 0.85)
      g.fillRoundedRect(4 + i * 8, 4, bw, 15, 1)
      // Book detail line
      g.fillStyle(0xffffff, 0.1)
      g.fillRect(5 + i * 8, 6, bw - 2, 1)
    }

    // Books (bottom shelf)
    const botColors = [0x0ea5e9, 0xa855f7, 0xf97316, 0x14b8a6, 0xe11d48]
    for (let i = 0; i < 5; i++) {
      const bw = 6 + (i % 3)
      g.fillStyle(botColors[i], 0.8)
      g.fillRoundedRect(5 + i * 9, 24, bw, 15, 1)
    }

    g.generateTexture('bookshelf', w, h)
    g.destroy()
  }

  private generateCoffeeMachine(): void {
    const w = 22
    const h = 30
    const g = this.g()

    // Machine body
    g.fillStyle(0x374151)
    g.fillRoundedRect(2, 2, 18, 28, 4)
    g.fillStyle(0x4b5563)
    g.fillRoundedRect(3, 3, 16, 26, 3)

    // Display
    g.fillStyle(0x10b981, 0.4)
    g.fillRoundedRect(5, 5, 12, 5, 1)
    // Display text
    g.fillStyle(0x10b981, 0.3)
    g.fillRect(6, 7, 6, 1)

    // Dispenser
    g.fillStyle(0x1f2937)
    g.fillRect(5, 14, 12, 10)

    // Cup
    g.fillStyle(0xf1f5f9, 0.8)
    g.fillRoundedRect(7, 17, 8, 6, 1)
    g.fillStyle(0x92400e, 0.4)
    g.fillRect(8, 18, 6, 4)

    // Steam particles
    g.fillStyle(0xffffff, 0.12)
    g.fillCircle(11, 14, 2)
    g.fillCircle(9, 11, 1.5)
    g.fillCircle(13, 12, 1)

    g.generateTexture('coffeemaker', w, h)
    g.destroy()
  }

  private generateChair(): void {
    const w = 24
    const h = 24
    const g = this.g()

    // Wheels
    g.fillStyle(0x1e293b)
    g.fillCircle(6, 22, 2)
    g.fillCircle(18, 22, 2)
    g.fillCircle(12, 23, 2)
    // Base
    g.fillStyle(0x374151)
    g.fillRect(8, 18, 8, 4)
    // Seat
    g.fillStyle(0x4b5563)
    g.fillRoundedRect(2, 10, 20, 10, 4)
    // Back
    g.fillStyle(0x374151)
    g.fillRoundedRect(4, 0, 16, 12, 4)
    g.fillStyle(0x4b5563)
    g.fillRoundedRect(5, 1, 14, 10, 3)

    g.generateTexture('chair', w, h)
    g.destroy()
  }

  private generateCeilingLight(): void {
    const w = 32
    const h = 12
    const g = this.g()

    // Fixture
    g.fillStyle(0x4b5563)
    g.fillRoundedRect(8, 0, 16, 4, 2)
    // Light panel
    g.fillStyle(0xfef9c3, 0.4)
    g.fillRoundedRect(2, 4, 28, 6, 2)
    // Glow
    g.fillStyle(0xfef9c3, 0.08)
    g.fillCircle(16, 8, 16)

    g.generateTexture('ceiling-light', w, h)
    g.destroy()
  }

  private generateWaterCooler(): void {
    const w = 18
    const h = 32
    const g = this.g()

    // Stand
    g.fillStyle(0x4b5563)
    g.fillRoundedRect(2, 18, 14, 14, 2)
    // Bottle
    g.fillStyle(0x60a5fa, 0.2)
    g.fillRoundedRect(4, 2, 10, 18, 4)
    g.fillStyle(0x93c5fd, 0.15)
    g.fillRoundedRect(5, 3, 8, 16, 3)
    // Water level
    g.fillStyle(0x3b82f6, 0.2)
    g.fillRect(5, 8, 8, 10)
    // Tap
    g.fillStyle(0x6b7280)
    g.fillRect(14, 22, 4, 3)

    g.generateTexture('water-cooler', w, h)
    g.destroy()
  }

  private generateRug(): void {
    const w = 80
    const h = 60
    const g = this.g()

    // Rug body
    g.fillStyle(0x1e3a5f, 0.5)
    g.fillRoundedRect(0, 0, w, h, 6)
    // Border
    g.lineStyle(2, 0x2563eb, 0.2)
    g.strokeRoundedRect(4, 4, w - 8, h - 8, 4)
    // Inner pattern
    g.fillStyle(0x1d4ed8, 0.08)
    g.fillRoundedRect(8, 8, w - 16, h - 16, 2)

    g.generateTexture('rug', w, h)
    g.destroy()
  }

  // ===== Effects =====

  private generateSpeechBubble(): void {
    const w = 140
    const h = 44
    const g = this.g()

    // Shadow
    g.fillStyle(0x000000, 0.12)
    g.fillRoundedRect(2, 2, w, h - 10, 10)
    // Body
    g.fillStyle(0x1e293b, 0.95)
    g.fillRoundedRect(0, 0, w, h - 10, 10)
    // Border
    g.lineStyle(1, 0x334155, 0.5)
    g.strokeRoundedRect(0, 0, w, h - 10, 10)
    // Tail
    g.fillStyle(0x1e293b, 0.95)
    g.fillTriangle(22, h - 10, 36, h - 10, 28, h - 2)

    g.generateTexture('speech-bubble', w, h)
    g.destroy()
  }

  private generateParticle(): void {
    const size = 4
    const g = this.g()
    g.fillStyle(0x60a5fa, 0.12)
    g.fillCircle(size / 2, size / 2, size / 2)
    g.generateTexture('particle', size, size)
    g.destroy()
  }

  private generateHoverRing(): void {
    const size = 40
    const g = this.g()
    g.lineStyle(2, 0xffffff, 0.3)
    g.strokeCircle(size / 2, size / 2, size / 2 - 2)
    g.generateTexture('hover-ring', size, size)
    g.destroy()
  }

  private generateTypingDots(): void {
    const w = 16
    const h = 6
    const g = this.g()
    g.fillStyle(0x60a5fa, 0.6)
    g.fillCircle(3, 3, 2)
    g.fillStyle(0x60a5fa, 0.4)
    g.fillCircle(8, 3, 2)
    g.fillStyle(0x60a5fa, 0.2)
    g.fillCircle(13, 3, 2)
    g.generateTexture('typing-dots', w, h)
    g.destroy()
  }

  // Helper: create offscreen graphics
  private g(): Phaser.GameObjects.Graphics {
    return this.make.graphics({ x: 0, y: 0 }, false)
  }
}
