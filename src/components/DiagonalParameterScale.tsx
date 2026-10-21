import { useEffect, useMemo, useRef, useState } from 'react'
import type { Material, Parameter, SearchResult } from '../types'
import MaterialDetailPanel from './MaterialDetailPanel'
import MaterialMarker from './MaterialMarker'
import ScaleNavigator from './ScaleNavigator'
import SearchByValue from './SearchByValue'

const clamp = (value: number) => Math.max(0, Math.min(1, value))

const priorityMaterials: Record<string, string[]> = {
  density: ['软木', '竹材', 'PVC', '碳纤维', '铝合金', '金刚石', '蓝宝石玻璃', '钛合金'],
  'elastic-modulus': ['软木', 'TPU', 'PP', 'PC', '羊毛纤维', 'PET', '橡木', '竹材', '混凝土', '镁合金', '铝合金', '黄铜', '铜', '铸铁', '不锈钢'],
  'thermal-conductivity': ['软木', 'PET', '竹材', '钢化玻璃', '混凝土', '瓷', '钛合金', '钛金属（纯钛）', '不锈钢', '蓝宝石玻璃', '镁合金'],
  'tensile-strength': ['PVC', 'PP', 'ABS', 'PMMA', 'PET', '瓷', '铝合金', '铜', '铸铁', '不锈钢', '钛合金'],
  'thermal-expansion': ['橡木', '不锈钢', '铝合金', '锌合金', 'PET', 'PC'],
}

function featuredNamesFor(parameter: Parameter): Set<string> {
  const selected = new Set(priorityMaterials[parameter.id] ?? [])
  const ordered = [...parameter.materials].sort((left, right) =>
    (left.min + left.max) / 2 - (right.min + right.max) / 2,
  )
  const centerOf = (name: string) => {
    const material = ordered.find((item) => item.name === name)
    return material ? (material.min + material.max) / 2 : null
  }

  if (parameter.id === 'density') {
    const cutoff = centerOf('钛合金')
    if (cutoff != null) ordered.filter((item) => (item.min + item.max) / 2 >= cutoff).forEach((item) => selected.add(item.name))
  }
  if (parameter.id === 'thermal-conductivity') {
    const cutoff = centerOf('镁合金')
    if (cutoff != null) ordered.filter((item) => (item.min + item.max) / 2 >= cutoff).forEach((item) => selected.add(item.name))
  }
  if (parameter.id === 'tensile-strength') {
    const lower = centerOf('PVC')
    const upper = centerOf('钛合金')
    if (lower != null) ordered.filter((item) => (item.min + item.max) / 2 <= lower).forEach((item) => selected.add(item.name))
    if (upper != null) ordered.filter((item) => (item.min + item.max) / 2 >= upper).forEach((item) => selected.add(item.name))
  }
  if (parameter.id === 'thermal-expansion') {
    const cutoff = centerOf('PC')
    if (cutoff != null) ordered.filter((item) => (item.min + item.max) / 2 >= cutoff).forEach((item) => selected.add(item.name))
  }
  return selected
}

function formatTick(value: number) {
  if (Math.abs(value) >= 1000) return value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
  if (Math.abs(value) >= 100) return value.toLocaleString('zh-CN', { maximumFractionDigits: 1 })
  if (Math.abs(value) >= 10) return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  return value.toLocaleString('zh-CN', { maximumSignificantDigits: 4 })
}

type Props = {
  parameter: Parameter
  selectedMaterial: Material | null
  highlightedNames: string[]
  focusValue: number | null
  onSelect: (material: Material) => void
  onClearSelection: () => void
  onSearchResult: (result: SearchResult) => void
}

type PlacedMarker = {
  material: Material
  ratio: number
  anchorX: number
  x: number
  y: number
  width: number
  height: number
  minX: number
  maxX: number
  intervalY: number
  displayMode: 'card' | 'dot'
  floatDelay: number
}

export default function DiagonalParameterScale({
  parameter,
  selectedMaterial,
  highlightedNames,
  focusValue,
  onSelect,
  onClearSelection,
  onSearchResult,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startScroll: number } | null>(null)
  const scrollFrameRef = useRef<number | null>(null)
  const [scrollState, setScrollState] = useState({ left: 0, width: 1, scrollWidth: 1 })
  const [showDragHint, setShowDragHint] = useState(true)
  const usesLogScale = ['elastic-modulus', 'thermal-conductivity', 'tensile-strength'].includes(parameter.id)
  const contentWidth = Math.max(5000, parameter.materials.length * 170)
  const plotLeft = 110
  const plotWidth = contentWidth - 220
  const canvasHeight = 700
  const axisY = 625
  const baseY = 535
  const slopeHeight = 360
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
  const selectedName = selectedMaterial?.name ?? ''

  const positions = useMemo(() => {
    const featuredNames = featuredNamesFor(parameter)
    const source = parameter.materials
      .map((material) => {
        const ratio = ratioOf((material.min + material.max) / 2)
        return {
          material,
          ratio,
          anchorX: plotLeft + ratio * plotWidth,
          minX: xOf(material.min),
          maxX: xOf(material.max),
          displayMode: featuredNames.has(material.name) ? 'card' as const : 'dot' as const,
        }
      })
      .sort((left, right) => left.minX - right.minX || left.maxX - right.maxX)

    const laneEnds: number[] = []
    const intervalYByName = new Map<string, number>()
    for (const item of source) {
      let lane = laneEnds.findIndex((end) => end + 10 <= item.minX)
      if (lane < 0) lane = laneEnds.length
      laneEnds[lane] = Math.max(item.maxX, item.minX + 8)
      intervalYByName.set(item.material.name, axisY - 14 - lane * 11)
    }
    const markerBottomLimit = Math.min(...intervalYByName.values()) - 14

    const placementOrder = [...source]
      .sort((left, right) => {
        const selectedDifference = Number(right.material.name === selectedName) - Number(left.material.name === selectedName)
        const cardDifference = Number(right.displayMode === 'card') - Number(left.displayMode === 'card')
        return selectedDifference || cardDifference || left.ratio - right.ratio
      })
    const placed: PlacedMarker[] = []
    const minY = 18
    const gap = 9

    const collides = (candidate: { x: number; y: number; width: number; height: number }) => placed.some((item) => {
      const horizontal = Math.abs(candidate.x - item.x) < (candidate.width + item.width) / 2 + gap
      const vertical = candidate.y < item.y + item.height + gap && candidate.y + candidate.height + gap > item.y
      return horizontal && vertical
    })

    for (const item of placementOrder) {
      const { material, ratio, anchorX, minX, maxX } = item
      const selected = material.name === selectedName
      const displayMode = selected ? 'card' as const : item.displayMode
      const dotLabelWidth = Math.max(48, Math.min(132, material.name.length * 10 + 14))
      const width = selected ? 344 : displayMode === 'card' ? 108 : dotLabelWidth
      const height = selected ? 160 : displayMode === 'card' ? 46 : 40
      const x = displayMode === 'card'
        ? Math.max(width / 2 + 12, Math.min(contentWidth - width / 2 - 12, anchorX))
        : anchorX
      const trendY = baseY - ratio * slopeHeight
      const maxY = Math.max(minY, markerBottomLimit - height)
      const preferredY = Math.max(minY, Math.min(maxY, trendY - height / 2))
      const step = selected ? 44 : displayMode === 'card' ? 30 : 18
      const offsets = [0]
      for (let offsetIndex = 1; offsetIndex <= Math.ceil((maxY - minY) / step); offsetIndex += 1) {
        offsets.push(-step * offsetIndex, step * offsetIndex)
      }
      let y: number | null = null

      for (const offset of offsets) {
        const candidateY = Math.max(minY, Math.min(maxY, preferredY + offset))
        if (!collides({ x, y: candidateY, width, height })) {
          y = candidateY
          break
        }
      }
      if (y == null) {
        for (let candidateY = minY; candidateY <= maxY; candidateY += 10) {
          if (!collides({ x, y: candidateY, width, height })) {
            y = candidateY
            break
          }
        }
      }
      placed.push({
        material,
        ratio,
        anchorX,
        x,
        y: y ?? minY,
        width,
        height,
        minX,
        maxX,
        intervalY: intervalYByName.get(material.name) ?? axisY - 14,
        displayMode,
        floatDelay: -(material.name.length * 0.17 + ratio * 1.8),
      })
    }

    return placed.sort((left, right) => left.ratio - right.ratio)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parameter.id, parameter.materials, selectedName, contentWidth])

  const updateScroll = () => {
    const element = viewportRef.current
    if (!element) return
    setScrollState({ left: element.scrollLeft, width: element.clientWidth, scrollWidth: element.scrollWidth })
  }

  const scheduleScrollUpdate = () => {
    if (scrollFrameRef.current != null) return
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null
      updateScroll()
    })
  }

  const finishViewportDrag = (element = viewportRef.current, pointerId = dragRef.current?.pointerId) => {
    dragRef.current = null
    element?.classList.remove('is-dragging')
    if (element && pointerId != null && element.hasPointerCapture(pointerId)) {
      try { element.releasePointerCapture(pointerId) } catch { /* pointer capture already ended */ }
    }
  }

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    updateScroll()
    const observer = new ResizeObserver(scheduleScrollUpdate)
    observer.observe(element)
    return () => {
      observer.disconnect()
      if (scrollFrameRef.current != null) window.cancelAnimationFrame(scrollFrameRef.current)
      scrollFrameRef.current = null
    }
  }, [parameter.id])

  useEffect(() => {
    setShowDragHint(true)
  }, [parameter.id])

  useEffect(() => {
    const handleWindowEnd = () => finishViewportDrag()
    window.addEventListener('blur', handleWindowEnd)
    window.addEventListener('pointerup', handleWindowEnd)
    window.addEventListener('pointercancel', handleWindowEnd)
    return () => {
      window.removeEventListener('blur', handleWindowEnd)
      window.removeEventListener('pointerup', handleWindowEnd)
      window.removeEventListener('pointercancel', handleWindowEnd)
      finishViewportDrag()
    }
  }, [])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const selected = positions.find((position) => position.material.name === selectedName)
    const ratio = focusValue == null ? selected?.ratio : ratioOf(focusValue)
    if (ratio == null) return
    const target = plotLeft + ratio * plotWidth - element.clientWidth / 2
    element.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedName, focusValue, parameter.id])

  const maxScroll = Math.max(scrollState.scrollWidth - scrollState.width, 1)
  const viewportStartRatio = scrollState.left / scrollState.scrollWidth
  const viewportSizeRatio = scrollState.width / scrollState.scrollWidth

  const seek = (ratio: number) => {
    const element = viewportRef.current
    if (!element) return
    element.scrollTo({ left: Math.max(0, Math.min(maxScroll, ratio * element.scrollWidth - element.clientWidth / 2)), behavior: 'smooth' })
  }

  const tickCount = 9

  const scrollByPage = (direction: -1 | 1) => {
    const element = viewportRef.current
    if (!element) return
    finishViewportDrag(element)
    element.scrollBy({
      left: direction * element.clientWidth * 0.8,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }

  return (
    <section className="scale-section" aria-labelledby="scale-title">
      <div className="section-heading scale-heading">
        <div>
          <p className="eyebrow">DIAGONAL PARAMETER SCALE</p>
          <h2 id="scale-title">斜向参数尺度表</h2>
          <p>
            {usesLogScale
              ? '横轴采用对数排布以展开低值区间；优先材料显示为标签，其余材料以可点击圆点呈现。纵向仅表达由低到高的视觉趋势。'
              : '优先材料显示为标签，其余材料以可点击圆点呈现；材料区间在数轴上分层错落，纵向不表示第二个变量。'}
          </p>
        </div>
        <div className="scale-heading__aside">
          <span className={`scale-mode-badge${usesLogScale ? ' is-log' : ''}`}>{usesLogScale ? '对数排布' : '线性排布'}</span>
          <div className="scale-legend" aria-label="图例">
            <span><i className="legend-trend" />低—高趋势</span>
            <span><i className="legend-projection" />区间投影</span>
            <span><i className="legend-dot" />其余材料</span>
            <span><i className="legend-selected" />当前选择</span>
          </div>
        </div>
      </div>

      <SearchByValue parameter={parameter} onResult={onSearchResult} embedded />

      <div className={`scale-workspace${selectedMaterial ? ' has-sidebar' : ''}`}>
        <div className="scale-workspace__main">
          <div className="scale-viewport-shell">
            <button type="button" className="scale-edge-guide scale-edge-guide--left" aria-label="向左翻看尺度表" title="向左翻看" onClick={() => scrollByPage(-1)}>‹</button>
            <button type="button" className="scale-edge-guide scale-edge-guide--right" aria-label="向右翻看尺度表" title="向右翻看" onClick={() => scrollByPage(1)}>›</button>
            {showDragHint && (
              <div className="scale-drag-hint" role="status">
                <span>可左右拖动尺度表，查看数轴材料。</span>
                <button type="button" onClick={() => setShowDragHint(false)} aria-label="关闭尺度表拖动提示">×</button>
              </div>
            )}
            <div
              ref={viewportRef}
              className="scale-viewport"
              onScroll={scheduleScrollUpdate}
              onDragStart={(event) => event.preventDefault()}
              onPointerDown={(event) => {
                if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
                if (!(event.target as HTMLElement).closest('.material-marker') && selectedMaterial) {
                  onClearSelection()
                }
                finishViewportDrag(event.currentTarget)
                dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScroll: event.currentTarget.scrollLeft }
                event.currentTarget.setPointerCapture(event.pointerId)
                event.currentTarget.classList.add('is-dragging')
                event.preventDefault()
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current
                if (!drag || drag.pointerId !== event.pointerId) return
                if (event.pointerType === 'mouse' && event.buttons === 0) {
                  finishViewportDrag(event.currentTarget, event.pointerId)
                  return
                }
                event.currentTarget.scrollLeft = drag.startScroll - (event.clientX - drag.startX)
                event.preventDefault()
              }}
              onPointerUp={(event) => finishViewportDrag(event.currentTarget, event.pointerId)}
              onPointerCancel={(event) => finishViewportDrag(event.currentTarget, event.pointerId)}
              onLostPointerCapture={(event) => finishViewportDrag(event.currentTarget, event.pointerId)}
            >
              <div className="scale-canvas" style={{ width: contentWidth }}>
          <svg className="scale-lines" width={contentWidth} height={canvasHeight} aria-hidden="true">
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
              anchorX={position.anchorX}
              y={position.y}
              width={position.width}
              height={position.height}
              minX={position.minX}
              maxX={position.maxX}
              axisY={axisY}
              intervalY={position.intervalY}
              displayMode={position.displayMode}
              floatDelay={position.floatDelay}
              selected={selectedName === position.material.name}
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
          <div className="axis-title" style={{ top: axisY + 50 }}>
            {parameter.name}（{parameter.unit}）{usesLogScale ? ' · 对数排布 / 真实数值刻度' : ''}
          </div>
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
        </div>
        {selectedMaterial && (
          <MaterialDetailPanel
            material={selectedMaterial}
            parameter={parameter}
            variant="sidebar"
            onClose={onClearSelection}
          />
        )}
      </div>
    </section>
  )
}
