import React, { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { createGameConfig } from '../game/config'

export default function GameCanvas(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    // Wait for fonts (Noto Sans KR) to load before creating Phaser game
    // so canvas text renders Korean characters correctly
    document.fonts.ready.then(() => {
      if (!containerRef.current || gameRef.current) return
      const config = createGameConfig(containerRef.current)
      gameRef.current = new Phaser.Game(config)
    })

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
      }}
    />
  )
}
