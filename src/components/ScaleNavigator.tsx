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
  const seek = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    onSeek(ratio)
  }

  return (
    <div className="scale-navigator">
      <div>
        <span>全轴缩略导航</span>
        <small>拖动或点击查看不同数值区间</small>
      </div>
      <div
        className="navigator-track"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          seek(event)
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) seek(event)
        }}
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
