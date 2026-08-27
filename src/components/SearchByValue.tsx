import { useEffect, useState } from 'react'
import type { Parameter, SearchResult } from '../types'

export default function SearchByValue({
  parameter,
  onResult,
  embedded = false,
}: {
  parameter: Parameter
  onResult: (result: SearchResult) => void
  embedded?: boolean
}) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)

  useEffect(() => {
    setInput('')
    setResult(null)
  }, [parameter.id])

  const search = () => {
    const value = Number(input)
    if (!input.trim() || !Number.isFinite(value)) {
      const next = { value: null, highlightedNames: [], selectedName: null, message: '请输入有效数值。', outOfRange: false }
      setResult(next)
      onResult(next)
      return
    }
    if (value < parameter.axisMin || value > parameter.axisMax) {
      const next = { value, highlightedNames: [], selectedName: null, message: '输入值超出当前参数轴范围。', outOfRange: true }
      setResult(next)
      onResult(next)
      return
    }

    const covered = parameter.materials
      .filter((material) => value >= material.min && value <= material.max)
      .sort((left, right) => Math.abs((left.min + left.max) / 2 - value) - Math.abs((right.min + right.max) / 2 - value))

    if (covered.length) {
      const names = covered.map((material) => material.name)
      const next = {
        value,
        highlightedNames: names,
        selectedName: names[0],
        message: `该数值落入 ${covered.length} 种基准材料的区间。`,
        outOfRange: false,
      }
      setResult(next)
      onResult(next)
      return
    }

    const nearest = [...parameter.materials]
      .sort((left, right) => {
        const leftDistance = Math.min(Math.abs(value - left.min), Math.abs(value - left.max))
        const rightDistance = Math.min(Math.abs(value - right.min), Math.abs(value - right.max))
        return leftDistance - rightDistance
      })
      .slice(0, 3)
    const names = nearest.map((material) => material.name)
    const next = {
      value,
      highlightedNames: names,
      selectedName: names[0] ?? null,
      message: `没有材料区间覆盖该数值，已标出最近的 ${nearest.length} 种基准材料。`,
      outOfRange: false,
    }
    setResult(next)
    onResult(next)
  }

  const clear = () => {
    setInput('')
    setResult(null)
    onResult({ value: null, highlightedNames: [], selectedName: null, message: '', outOfRange: false })
  }

  return (
    <section className={`search-panel${embedded ? ' search-panel--embedded' : ''}`} aria-labelledby="search-title">
      <div>
        <p className="eyebrow">LOCATE A VALUE</p>
        <h2 id="search-title">按参数数值定位材料</h2>
        <p>输入一个数值，尺度表会定位并高亮覆盖该数值或距离最近的基准材料。</p>
      </div>
      <div className="search-form">
        <label htmlFor="parameter-value">输入{parameter.name}数值，单位：{parameter.unit}</label>
        <div className="input-row">
          <input
            id="parameter-value"
            type="number"
            min={parameter.axisMin}
            max={parameter.axisMax}
            step="any"
            value={input}
            placeholder={`${parameter.axisMin}–${parameter.axisMax}`}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') search() }}
          />
          <span>{parameter.unit}</span>
          <button type="button" className="primary-button" onClick={search}>定位</button>
          {(input || result) && <button type="button" className="text-button" onClick={clear}>清除</button>}
        </div>
        {result && (
          <div className={`search-result${result.outOfRange ? ' is-error' : ''}`} role="status">
            <strong>{result.outOfRange ? '超出范围' : '定位结果'}</strong>
            <span>{result.message}</span>
            {!!result.highlightedNames.length && <small>{result.highlightedNames.join('、')}</small>}
          </div>
        )}
      </div>
    </section>
  )
}
