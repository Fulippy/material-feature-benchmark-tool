import { useEffect, useMemo, useRef, useState } from 'react'
import type { Material, Parameter, SearchResult } from '../types'
import MaterialMarker from './MaterialMarker'
import ScaleNavigator from './ScaleNavigator'
import SearchByValue from './SearchByValue'

const clamp = (value: number) => Math.max(0, Math.min(1, value))

function formatTick(value: number) {
  if (Math.abs(value) >= 1000) return value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
  if (Math.abs(value) >= 100) return value.toLocaleString('zh-CN', { maximumFractionDigits: 1 })
  if (Math.abs(value) >= 10) return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  return value.toLocaleString('zh-CN', { maximumSignificantDigits: 4 })
}

type Props = {
  parameter: Parameter
  selectedMaterial: Material
  highlightedNames: string[]
  focusValue: number | null
  onSelect: (material: Material) => void
  onSearchResult: (result: SearchResult) => void
}

type PlacedMarker = {
  material: Material
  ratio: number
  x: number
  y: number
  width: number
  height: number
  minX: number
  maxX: number
}

export default function DiagonalParameterScale({
  parameter,
  selectedMaterial,
  highlightedNames,
  focusValue,
  onSelect,
  onSearchResult,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startScroll: number } | null>(null)
  const [scrollState, setScrollState] = useState({ left: 0, width: 1, scrollWidth: 1 })
  const usesLogScale = ['elastic-modulus', 'thermal-conductivity', 'tensile-strength'].includes(parameter.id)
  const contentWidth = Math.max(5000, parameter.materials.length * 172)
  const plotLeft = 110
  const plotWidth = contentWidth - 220
  const axisY = 694
  const baseY = 574
  const slopeHeight = 390
  const logShift = parameter.axisMin <= 0 ? 1 - parameter.axisMin : 0
  const transformValue = (value: number) => usesLogScale ? Math.log10(Math.max(value + logShift, Number.EPSILON)) : value
  const transformedMin = transformValue(parameter.axisMin)
  const transformedMax = transformValue(parameter.axisMax)
  const transformedSpan = transformedMax - transformedMin
  const ratioOf = (value: number) => clamp((transformValue(value) - transformedMin) / transformedSpan)
  const valueAtRatio = (ratio: number) => usesLogScale
    ? 10 ** (transformedMin + ratio * transformedSpan) - logShift
    : parameter.axisMin + ratio * (parameter.axisMax - parameter.axisMin)
  const xOf = (value: number) => plotLeft + ratioOf(value) * plotWidth

  const positions = useMemo(() => {
    const source = [...parameter.materials]
      .map((material) => ({ material, ratio: ratioOf((material.min + material.max) / 2) }))
      .sort((left, right) => {
        const selectedDifference = Number(right.material.name === selectedMaterial.name) - Number(left.material.name === selectedMaterial.name)
        return selectedDifference || left.ratio - right.ratio
      })
    const placed: PlacedMarker[] = []
    const minY = 18
    const gap = 10

    const collides = (candidate: { x: number; y: number; width: number; height: number }) => placed.some((item) => {
      const horizontal = Math.abs(candidate.x - item.x) < (candidate.width + item.width) / 2 + gap
      const vertical = candidate.y < item.y + item.height + gap && candidate.y + candidate.height + gap > item.y
      return horizontal && vertical
    })

    for (const { material, ratio } of source) {
      const selected = material.name === selectedMaterial.name
      const width = selected ? 184 : 88
      const height = selected ? 120 : 52
      const x = plotLeft + ratio * plotWidth
      const minX = xOf(material.min)
      const maxX = xOf(material.max)
      const trendY = baseY - ratio * slopeHeight
      const preferredY = Math.max(minY, Math.min(axisY - height - 26, trendY - height / 2))
      const offsets = [0, -62, 62, -124, 124, -186, 186, -248, 248, -310, 310, -372, 372]
      let y: number | null = null

      for (const offset of offsets) {
        const candidateY = Math.max(minY, Math.min(axisY - height - 26, preferredY + offset))
        if (!collides({ x, y: candidateY, width, height })) {
          y = candidateY
          break
        }
      }
      if (y == null) {
        for (let candidateY = minY; candidateY <= axisY - height - 26; candidateY += 12) {
          if (!collides({ x, y: candidateY, width, height })) {
            y = candidateY
            break
          }
        }
      }
      placed.push({ material, ratio, x, y: y ?? minY, width, height, minX, maxX })
    }

    return placed.sort((left, right) => left.ratio - right.ratio)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parameter.id, parameter.materials, selectedMaterial.name, contentWidth])

  const updateScroll = () => {
    const element = viewportRef.current
    if (!element) return
    setScrollState({ left: element.scrollLeft, width: element.clientWidth, scrollWidth: element.scrollWidth })
  }

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    updateScroll()
    const observer = new ResizeObserver(updateScroll)
    observer.observe(element)
    return () => observer.disconnect()
  }, [parameter.id])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const selected = positions.find((position) => position.material.name === selectedMaterial.name)
    const ratio = focusValue == null ? selected?.ratio : ratioOf(focusValue)
    if (ratio == null) return
    const target = plotLeft + ratio * plotWidth - element.clientWidth / 2
    element.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMaterial.name, focusValue, parameter.id])

  const maxScroll = Math.max(scrollState.scrollWidth - scrollState.width, 1)
  const viewportStartRatio = scrollState.left / scrollState.scrollWidth
  const viewportSizeRatio = scrollState.width / scrollState.scrollWidth

  const seek = (ratio: number) => {
    const element = viewportRef.current
    if (!element) return
    element.scrollTo({ left: Math.max(0, Math.min(maxScroll, ratio * element.scrollWidth - element.clientWidth / 2)), behavior: 'smooth' })
  }

  const tickCount = 9

  return (
    <section className="scale-section" aria-labelledby="scale-title">
      <div className="section-heading scale-heading">
        <div>
          <p className="eyebrow">DIAGONAL PARAMETER SCALE</p>
          <h2 id="scale-title">斜向参数尺度表</h2>
          <p>
            {usesLogScale
              ? '横轴采用对数排布以展开低值区间，刻度标签仍显示真实参数数值；纵向仅表达由低到高的视觉趋势。'
              : '材料的真实位置由横向线性数值轴决定；纵向高度仅用于形成由低到高的视觉趋势。'}
          </p>
        </div>
        <div className="scale-heading__aside">
          <span className={`scale-mode-badge${usesLogScale ? ' is-log' : ''}`}>{usesLogScale ? '对数排布' : '线性排布'}</span>
          <div className="scale-legend" aria-label="图例">
            <span><i className="legend-trend" />低—高趋势</span>
            <span><i className="legend-projection" />区间投影</span>
            <span><i className="legend-selected" />当前选择</span>
          </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="scale-viewport"
        onScroll={updateScroll}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('button')) return
          dragRef.current = { startX: event.clientX, startScroll: event.currentTarget.scrollLeft }
          event.currentTarget.setPointerCapture(event.pointerId)
          event.currentTarget.classList.add('is-dragging')
        }}
        onPointerMove={(event) => {
          if (!dragRef.current) return
          event.currentTarget.scrollLeft = dragRef.current.startScroll - (event.clientX - dragRef.current.startX)
        }}
        onPointerUp={(event) => {
          dragRef.current = null
          event.currentTarget.releasePointerCapture(event.pointerId)
          event.currentTarget.classList.remove('is-dragging')
        }}
      >
        <div className="scale-canvas" style={{ width: contentWidth }}>
          <svg className="scale-lines" width={contentWidth} height="778" aria-hidden="true">
            <defs>
              <linearGradient id="trendGradient" x1="0" x2="1">
                <stop offset="0" stopColor="#22364d" stopOpacity="0.55" />
                <stop offset="1" stopColor="#11263e" />
              </linearGradient>
            </defs>
            <line x1={plotLeft} y1={baseY} x2={plotLeft + plotWidth} y2={baseY - slopeHeight} stroke="url(#trendGradient)" strokeWidth="2.5" />
            <line x1={plotLeft} y1={axisY} x2={plotLeft + plotWidth} y2={axisY} stroke="#23374d" strokeWidth="2" />
            {Array.from({ length: tickCount }, (_, index) => {
              const ratio = index / (tickCount - 1)
              const x = plotLeft + ratio * plotWidth
              return <g key={index}>
                <line x1={x} y1={axisY - 6} x2={x} y2={axisY + 8} stroke="#23374d" />
                <line x1={x} y1="28" x2={x} y2={axisY} stroke="#7592ad" strokeOpacity="0.13" />
              </g>
            })}
            {focusValue != null && focusValue >= parameter.axisMin && focusValue <= parameter.axisMax && (
              <line
                className="search-value-line"
                x1={xOf(focusValue)} y1="22" x2={xOf(focusValue)} y2={axisY + 8}
                stroke="#6f49a5" strokeWidth="2" strokeDasharray="5 6"
              />
            )}
          </svg>

          <div className="trend-label trend-label--low">低</div>
          <div className="trend-label trend-label--high">高</div>
          {focusValue != null && focusValue >= parameter.axisMin && focusValue <= parameter.axisMax && (
            <div className="search-value-tag" style={{ left: xOf(focusValue) }}>
              {formatTick(focusValue)} {parameter.unit}
            </div>
          )}

          {positions.map((position) => (
            <MaterialMarker
              key={position.material.name}
              material={position.material}
              unit={parameter.unit}
              x={position.x}
              y={position.y}
              width={position.width}
              height={position.height}
              minX={position.minX}
              maxX={position.maxX}
              axisY={axisY}
              selected={selectedMaterial.name === position.material.name}
              highlighted={highlightedNames.includes(position.material.name)}
              onSelect={onSelect}
            />
          ))}

          <div className="axis-ticks" style={{ left: plotLeft, width: plotWidth, top: axisY + 12 }}>
            {Array.from({ length: tickCount }, (_, index) => {
              const ratio = index / (tickCount - 1)
              return <span key={index} style={{ left: `${ratio * 100}%` }}>{formatTick(valueAtRatio(ratio))}</span>
            })}
          </div>
          <div className="axis-title" style={{ top: axisY + 48 }}>
            {parameter.name}（{parameter.unit}）{usesLogScale ? ' · 对数排布 / 真实数值刻度' : ''}
          </div>
        </div>
      </div>

      <ScaleNavigator
        materials={parameter.materials}
        axisMin={parameter.axisMin}
        axisMax={parameter.axisMax}
        startRatio={viewportStartRatio}
        sizeRatio={viewportSizeRatio}
        positionRatio={ratioOf}
        onSeek={seek}
      />
      <SearchByValue parameter={parameter} onResult={onSearchResult} embedded />
    </section>
  )
}
