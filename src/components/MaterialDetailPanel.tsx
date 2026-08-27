import { useEffect, useState } from 'react'
import type { Material, Parameter } from '../types'
import CaseCard from './CaseCard'

export default function MaterialDetailPanel({ material, parameter }: { material: Material; parameter: Parameter }) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => setExpanded(false), [material.name])
  const visibleCases = expanded ? material.cases : material.cases.slice(0, 3)

  return (
    <section className="material-detail" aria-labelledby="material-detail-title">
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
        <p>{material.cognitiveText}</p>
      </div>

      <div className="case-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">APPLICATION CONTEXT</p>
            <h2>应用案例</h2>
          </div>
          <span>{material.cases.length} 条已匹配案例</span>
        </div>
        {visibleCases.length ? (
          <>
            <div className="case-grid">
              {visibleCases.map((item, index) => <CaseCard key={`${item.productName}-${index}`} item={item} />)}
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
    </section>
  )
}
