import { useState } from 'react'
import type { MaterialCase } from '../types'
import { publicAssetUrl } from '../utils/assets'
import CaseDetailModal from './CaseDetailModal'

const matchLabel = {
  exact: '完全匹配',
  contains: '包含匹配',
  fuzzy: '近似匹配',
  unmatched: '未匹配',
}

type Props = {
  item: MaterialCase
  items: MaterialCase[]
  initialIndex: number
}

export default function CaseCard({ item, items, initialIndex }: Props) {
  const [image, setImage] = useState(() => publicAssetUrl(item.image))
  const [detailOpen, setDetailOpen] = useState(false)

  return (
    <article
      className="case-card"
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={`查看${item.productName}案例大图与介绍`}
      onClick={() => setDetailOpen(true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setDetailOpen(true)
        }
      }}
    >
      <div className="case-card__image">
        <img
          src={image}
          alt={`${item.productName} 产品案例`}
          loading="lazy"
          onError={() => setImage(publicAssetUrl('/assets/cases/placeholder.svg'))}
        />
        <span>点击查看</span>
      </div>
      <div className="case-card__body">
        <p className="case-material">提及材料 · {item.sourceMaterial} · {matchLabel[item.matchType]}</p>
        <h3>{item.productName}</h3>
        <p>{item.description || '原始数据未提供产品简介。'}</p>
      </div>
      {detailOpen && (
        <CaseDetailModal
          items={items}
          initialIndex={initialIndex}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </article>
  )
}
