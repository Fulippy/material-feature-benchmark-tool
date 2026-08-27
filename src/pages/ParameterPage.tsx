import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import rawData from '../data/materials_mapping.json'
import DataNotice from '../components/DataNotice'
import DiagonalParameterScale from '../components/DiagonalParameterScale'
import MaterialDetailPanel from '../components/MaterialDetailPanel'
import ParameterAnimation from '../components/ParameterAnimation'
import ParameterIcon from '../components/ParameterIcon'
import type { MaterialsMapping, SearchResult } from '../types'

const data = rawData as MaterialsMapping

export default function ParameterPage() {
  const { parameterId } = useParams()
  const parameter = data.parameters.find((item) => item.id === parameterId)
  const [selectedName, setSelectedName] = useState('')
  const [searchResult, setSearchResult] = useState<SearchResult>({
    value: null, highlightedNames: [], selectedName: null, message: '', outOfRange: false,
  })

  useEffect(() => {
    setSelectedName(parameter?.materials[0]?.name ?? '')
    setSearchResult({ value: null, highlightedNames: [], selectedName: null, message: '', outOfRange: false })
  }, [parameter?.id])

  if (!parameter) return <Navigate to="/" replace />
  const selectedMaterial = parameter.materials.find((material) => material.name === selectedName) ?? parameter.materials[0]
  if (!selectedMaterial) return <Navigate to="/" replace />

  const handleSearch = (result: SearchResult) => {
    setSearchResult(result)
    if (result.selectedName) setSelectedName(result.selectedName)
  }

  return (
    <main className="parameter-page">
      <section className="parameter-hero page-width">
        <div className="breadcrumb"><Link to="/">参数首页</Link><span>/</span><strong>{parameter.name}</strong></div>
        <div className="parameter-hero__grid">
          <div className="parameter-hero__icon"><ParameterIcon type={parameter.iconType} size={138} animated /></div>
          <div>
            <p className="eyebrow">PARAMETER 0{data.parameters.findIndex((item) => item.id === parameter.id) + 1}</p>
            <h1>{parameter.name}</h1>
            <div className="unit-line"><span>单位</span><strong>{parameter.unit}</strong></div>
            <p className="parameter-definition">{parameter.definition}</p>
            <p className="design-meaning"><span>设计认知</span>{parameter.designMeaning}</p>
          </div>
          <div className="axis-summary">
            <p>主轴范围</p>
            <strong>{parameter.axisMin}<i>—</i>{parameter.axisMax}</strong>
            <span>{parameter.unit}</span>
            <small>{parameter.materials.length} 种基准材料</small>
          </div>
        </div>
      </section>

      <div className="parameter-content page-width">
        <ParameterAnimation type={parameter.iconType} name={parameter.name} />

        <DiagonalParameterScale
          parameter={parameter}
          selectedMaterial={selectedMaterial}
          highlightedNames={searchResult.highlightedNames}
          focusValue={searchResult.outOfRange ? null : searchResult.value}
          onSearchResult={handleSearch}
          onSelect={(material) => {
            setSelectedName(material.name)
            setSearchResult((current) => ({ ...current, highlightedNames: [] }))
          }}
        />

        <MaterialDetailPanel material={selectedMaterial} parameter={parameter} />
        <DataNotice />
      </div>
    </main>
  )
}
