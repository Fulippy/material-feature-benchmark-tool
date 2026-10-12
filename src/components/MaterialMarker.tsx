import { useState } from 'react'
import type { Material } from '../types'
import { publicAssetUrl } from '../utils/assets'
import ImageLightbox from './ImageLightbox'

type Props = {
  material: Material
  unit: string
  x: number
  anchorX: number
  y: number
  width: number
  height: number
  minX: number
  maxX: number
  axisY: number
  intervalY: number
  displayMode: 'card' | 'dot'
  floatDelay: number
  selected: boolean
  highlighted: boolean
  onSelect: (material: Material) => void
}

const materialPlaceholder = publicAssetUrl('/assets/materials/placeholder.svg')

function MaterialImage({ source, alt }: { source: string; alt: string }) {
  const [image, setImage] = useState(() => publicAssetUrl(source))
  return <img src={image} alt={alt} loading="lazy" onError={() => setImage(materialPlaceholder)} />
}

function Tooltip({ material, unit }: { material: Material; unit: string }) {
  return (
    <span className="marker-tooltip" role="tooltip">
      <b>{material.name}</b>
      <em>{material.category}</em>
      <span>{material.min}–{material.max} {unit}</span>
    </span>
  )
}

export default function MaterialMarker({
  material,
  unit,
  x,
  anchorX,
  y,
  width,
  height,
  minX,
  maxX,
  axisY,
  intervalY,
  displayMode,
  floatDelay,
  selected,
  highlighted,
  onSelect,
}: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const active = selected || highlighted
  const intervalWidth = Math.max(maxX - minX, 8)
  const isDot = displayMode === 'dot' && !selected
  const markerBottom = y + height
  const mainImage = material.image

  return (
    <>
      <div
        className={`material-projection${active ? ' is-active' : ''}${isDot ? ' is-dot-projection' : ''}`}
        style={{ left: anchorX, top: markerBottom, height: Math.max(axisY - markerBottom, 0) }}
        aria-hidden="true"
      />

      {isDot ? (
        <button
          type="button"
          className={`material-dot${highlighted ? ' is-highlighted' : ''}`}
          style={{ left: anchorX, top: y, width, height, animationDelay: `${floatDelay}s` }}
          onClick={() => onSelect(material)}
          aria-label={`展开${material.name}，${material.min} 至 ${material.max} ${unit}`}
        >
          <span className="material-dot__label">{material.name}</span>
          <span className="material-dot__core" aria-hidden="true" />
          <Tooltip material={material} unit={unit} />
        </button>
      ) : (
        <article
          className={`material-marker${selected ? ' is-selected' : ''}${highlighted ? ' is-highlighted' : ''}`}
          style={{ left: x, top: y, width, height }}
        >
          <button
            type="button"
            className="marker-select"
            onClick={(event) => {
              if (selected && (event.target as HTMLElement).closest('.marker-image')) {
                setLightboxIndex(0)
                return
              }
              onSelect(material)
            }}
            aria-pressed={selected}
            aria-label={selected ? `${material.name}，点击主图查看大图，点击名称关闭详情` : `选择${material.name}`}
          >
            <span className="marker-image" title={selected ? '点击查看材料主图大图' : undefined}>
              <MaterialImage source={material.image} alt={`${material.name}材料主图`} />
            </span>
            <span className="marker-copy">
              <strong>{material.name}</strong>
              <small>{material.min}–{material.max} {selected ? unit : ''}</small>
              {selected && <em>{material.category}</em>}
            </span>
          </button>

          {selected && (
            <div className="marker-expanded-content">
              <p>{material.description || '材料简介'}</p>
            </div>
          )}
          {!selected && <Tooltip material={material} unit={unit} />}
        </article>
      )}

      <button
        type="button"
        className={`material-interval${active ? ' is-active' : ''}`}
        style={{ left: minX, top: intervalY, width: intervalWidth }}
        onClick={() => onSelect(material)}
        aria-label={`选择${material.name}，区间 ${material.min} 至 ${material.max} ${unit}`}
      />
      {lightboxIndex != null && (
        <ImageLightbox
          images={[mainImage]}
          initialIndex={lightboxIndex}
          materialName={material.name}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  )
}
