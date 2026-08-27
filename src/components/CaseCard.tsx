import { useState } from 'react'
import type { MaterialCase } from '../types'
import { publicAssetUrl } from '../utils/assets'

const matchLabel = {
  exact: '完全匹配',
  contains: '包含匹配',
  fuzzy: '近似匹配',
  unmatched: '未匹配',
}

export default function CaseCard({ item }: { item: MaterialCase }) {
  const [image, setImage] = useState(() => publicAssetUrl(item.image))

  return (
    <article className="case-card">
      <div className="case-card__image">
        <img
          src={image}
          alt={`${item.productName} 产品案例`}
          loading="lazy"
          onError={() => setImage(publicAssetUrl('/assets/cases/placeholder.svg'))}
        />
        <span>{matchLabel[item.matchType]}</span>
      </div>
      <div className="case-card__body">
        <p className="case-material">提及材料 · {item.sourceMaterial}</p>
        <h3>{item.productName}</h3>
        <p>{item.description || '原始数据未提供产品简介。'}</p>
      </div>
    </article>
  )
}
