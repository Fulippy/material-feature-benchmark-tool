import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Material } from '../types'

type Props = {
  materials: Material[]
  axisMin: number
  axisMax: number
  startRatio: number
  sizeRatio: number
  positionRatio: (value: number) => number
  onSeek: (ratio: number) => void
}

export default function ScaleNavigator({ materials, axisMin, axisMax, startRatio, sizeRatio, positionRatio, onSeek }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const activePointerRef = useRef<number | null>(null)

  const seek = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    onSeek(ratio)
  }

  const finishDrag = (element = trackRef.current, pointerId = activePointerRef.current) => {
    activePointerRef.current = null
    element?.classList.remove('is-dragging')
    if (element && pointerId != null && element.hasPointerCapture(pointerId)) {
      try { element.releasePointerCapture(pointerId) } catch { /* pointer capture already ended */ }
    }
  }

  useEffect(() => {
    const handleWindowEnd = () => finishDrag()
    window.addEventListener('blur', handleWindowEnd)
    window.addEventListener('pointerup', handleWindowEnd)
    window.addEventListener('pointercancel', handleWindowEnd)
    return () => {
      window.removeEventListener('blur', handleWindowEnd)
      window.removeEventListener('pointerup', handleWindowEnd)
      window.removeEventListener('pointercancel', handleWindowEnd)
      finishDrag()
    }
  }, [])

  return (
    <div className="scale-navigator">
      <div>
        <span>全轴缩略导航</span>
        <small>拖动或点击查看不同数值区间</small>
      </div>
      <div
        ref={trackRef}
        className="navigator-track"
        onPointerDown={(event) => {
          if (event.button !== 0) return
          finishDrag(event.currentTarget)
          activePointerRef.current = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId)
          event.currentTarget.classList.add('is-dragging')
          seek(event)
          event.preventDefault()
        }}
        onPointerMove={(event) => {
          if (activePointerRef.current !== event.pointerId) return
          if (event.pointerType === 'mouse' && event.buttons === 0) {
            finishDrag(event.currentTarget, event.pointerId)
            return
          }
          seek(event)
          event.preventDefault()
        }}
        onPointerUp={(event) => finishDrag(event.currentTarget, event.pointerId)}
        onPointerCancel={(event) => finishDrag(event.currentTarget, event.pointerId)}
        onLostPointerCapture={(event) => finishDrag(event.currentTarget, event.pointerId)}
      >
        <div className="navigator-trend" />
        {materials.map((material) => {
          const center = (material.min + material.max) / 2
          const ratio = positionRatio(center)
          return <i key={material.name} style={{ left: `${ratio * 100}%` }} />
        })}
        <div
          className="navigator-window"
          style={{ left: `${startRatio * 100}%`, width: `${Math.max(sizeRatio * 100, 4)}%` }}
        />
      </div>
      <div className="navigator-values"><span>{axisMin}</span><span>{axisMax}</span></div>
    </div>
  )
}
