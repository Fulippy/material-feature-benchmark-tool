import { useState } from 'react'
import type { Material } from '../types'
import { publicAssetUrl } from '../utils/assets'

type Props = {
  material: Material
  unit: string
  x: number
  y: number
  width: number
  height: number
  minX: number
  maxX: number
  axisY: number
  selected: boolean
  highlighted: boolean
  onSelect: (material: Material) => void
}

export default function MaterialMarker({
  material,
  unit,
  x,
  y,
  width,
  height,
  minX,
  maxX,
  axisY,
  selected,
  highlighted,
  onSelect,
}: Props) {
  const [image, setImage] = useState(() => publicAssetUrl(material.image))
  const active = selected || highlighted
  const className = `material-marker${selected ? ' is-selected' : ''}${highlighted ? ' is-highlighted' : ''}`
  const intervalWidth = Math.max(maxX - minX, 8)

  return (
    <>
      <div
        className={`material-projection${active ? ' is-active' : ''}`}
        style={{ left: x, top: y + height, height: Math.max(axisY - y - height, 0) }}
        aria-hidden="true"
      />
      <button
        type="button"
        className={className}
        style={{ left: x, top: y, width, height }}
        onClick={() => onSelect(material)}
        aria-pressed={selected}
      >
        <span className="marker-image">
          <img src={image} alt="" loading="lazy" onError={() => setImage(publicAssetUrl('/assets/cases/placeholder.svg'))} />
        </span>
        <span className="marker-copy">
          <strong>{material.name}</strong>
          <small>{material.min}–{material.max}</small>
          {selected && (
            <span className="marker-expanded-content">
              <em>{material.category}</em>
              <span>{material.description || '材料简介'}</span>
              <b>{material.min}–{material.max} {unit}</b>
            </span>
          )}
        </span>
        {!selected && (
          <span className="marker-tooltip" role="tooltip">
            <b>{material.name}</b>
            <em>{material.category}</em>
            <span>{material.min}–{material.max} {unit}</span>
          </span>
        )}
      </button>
      <button
        type="button"
        className={`material-interval${active ? ' is-active' : ''}`}
        style={{ left: minX, top: axisY - 15, width: intervalWidth }}
        onClick={() => onSelect(material)}
        aria-label={`选择${material.name}，区间 ${material.min} 至 ${material.max} ${unit}`}
      />
    </>
  )
}
