import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { OfficeScene } from './scenes/OfficeScene'
import { UIOverlayScene } from './scenes/UIOverlayScene'
import { TILE_SIZE, OFFICE_WIDTH, OFFICE_HEIGHT } from './constants'

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: OFFICE_WIDTH * TILE_SIZE,
    height: OFFICE_HEIGHT * TILE_SIZE,
    pixelArt: true,
    backgroundColor: '#0b1120',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, OfficeScene, UIOverlayScene],
  }
}
