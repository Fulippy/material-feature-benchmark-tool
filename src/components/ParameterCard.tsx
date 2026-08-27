import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Parameter } from '../types'
import ParameterIcon from './ParameterIcon'

export default function ParameterCard({ parameter, index }: { parameter: Parameter; index: number }) {
  return (
    <Link
      to={`/parameter/${parameter.id}`}
      className="parameter-card"
      style={{ '--card-index': index } as CSSProperties}
    >
      <div className="parameter-card__topline">
        <span>0{index + 1}</span>
        <span>{parameter.materials.length} 种基准材料</span>
      </div>
      <ParameterIcon type={parameter.iconType} />
      <div className="parameter-card__body">
        <p className="eyebrow">{parameter.unit}</p>
        <h2>{parameter.name}</h2>
        <p>{parameter.definition}</p>
      </div>
      <div className="parameter-card__action">
        进入参数尺度
        <span aria-hidden="true">→</span>
      </div>
    </Link>
  )
}
