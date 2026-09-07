import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { publicAssetUrl } from '../utils/assets'

type Props = {
  images: string[]
  initialIndex: number
  materialName: string
  onClose: () => void
}

const placeholder = publicAssetUrl('/assets/materials/placeholder.svg')

export default function ImageLightbox({ images, initialIndex, materialName, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const [imageFailed, setImageFailed] = useState(false)
  const hasMultiple = images.length > 1

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && hasMultiple) setIndex((current) => (current - 1 + images.length) % images.length)
      if (event.key === 'ArrowRight' && hasMultiple) setIndex((current) => (current + 1) % images.length)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [hasMultiple, images.length, onClose])

  useEffect(() => setImageFailed(false), [index])

  return createPortal(
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${materialName}材料大图`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="image-lightbox__panel">
        <div className="image-lightbox__header">
          <div>
            <strong>{materialName}</strong>
            <span>{index + 1} / {images.length}</span>
          </div>
          <button type="button" className="image-lightbox__close" onClick={onClose} autoFocus aria-label="关闭材料大图">×</button>
        </div>
        <div className="image-lightbox__stage">
          {hasMultiple && (
            <button
              type="button"
              className="image-lightbox__arrow image-lightbox__arrow--previous"
              onClick={() => setIndex((current) => (current - 1 + images.length) % images.length)}
              aria-label="查看上一张材料图片"
            >
              ‹
            </button>
          )}
          <img
            src={imageFailed ? placeholder : publicAssetUrl(images[index])}
            alt={`${materialName}材料大图 ${index + 1}`}
            onError={() => setImageFailed(true)}
          />
          {hasMultiple && (
            <button
              type="button"
              className="image-lightbox__arrow image-lightbox__arrow--next"
              onClick={() => setIndex((current) => (current + 1) % images.length)}
              aria-label="查看下一张材料图片"
            >
              ›
            </button>
          )}
        </div>
        <p>可使用左右方向键切换图片，按 Esc 关闭。</p>
      </div>
    </div>,
    document.body,
  )
}
