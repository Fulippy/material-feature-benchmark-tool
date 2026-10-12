import { useEffect, useState } from 'react'
import type { Material, Parameter } from '../types'
import CaseCard from './CaseCard'

type Props = {
  material: Material
  parameter: Parameter
  variant?: 'full' | 'sidebar'
  onClose?: () => void
}

export default function MaterialDetailPanel({ material, parameter, variant = 'full', onClose }: Props) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => setExpanded(false), [material.name])
  const visibleCases = expanded ? material.cases : material.cases.slice(0, 3)

  return (
    <aside className={`material-detail material-detail--${variant}`} aria-labelledby="material-detail-title">
      {onClose && (
        <button type="button" className="material-detail__close" onClick={onClose} aria-label="关闭应用案例库">
          <span aria-hidden="true">×</span>
        </button>
      )}
      <div className="material-detail__summary">
        <div>
          <p className="eyebrow">SELECTED BENCHMARK</p>
          <h2 id="material-detail-title">{material.name}</h2>
          <span className="category-chip">{material.category}</span>
        </div>
        <div className="material-range-card">
          <span>{parameter.name}区间</span>
          <strong>{material.min}–{material.max}</strong>
          <small>{parameter.unit}</small>
        </div>
        <div className="material-detail__description">
          <p>{material.description || '材料简介'}</p>
          <small>{material.cognitiveText}</small>
        </div>
      </div>

      <div className="case-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">APPLICATION CONTEXT</p>
            <h2>应用案例库</h2>
          </div>
          <span>{material.cases.length} 条已匹配案例</span>
        </div>
        {visibleCases.length ? (
          <>
            <div className="case-grid">
              {visibleCases.map((item, index) => (
                <CaseCard
                  key={`${item.productName}-${index}`}
                  item={item}
                  items={material.cases}
                  initialIndex={index}
                />
              ))}
            </div>
            {material.cases.length > 3 && (
              <button type="button" className="secondary-button show-more" onClick={() => setExpanded((value) => !value)}>
                {expanded ? '收起案例' : `查看更多（共 ${material.cases.length} 条）`}
              </button>
            )}
          </>
        ) : (
          <div className="empty-state">
            <span aria-hidden="true">○</span>
            <p>暂未匹配到该材料的产品案例。</p>
          </div>
        )}
      </div>
    </aside>
  )
}
