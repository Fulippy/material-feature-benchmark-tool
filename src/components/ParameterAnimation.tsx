import { useState, type CSSProperties } from 'react'
import ParameterIcon from './ParameterIcon'

function DensityAnimation({ level }: { level: number }) {
  const depth = 4 + level * 0.24
  return (
    <div className="demo-stage adjustable-demo density-adjustable" aria-label="密度由低到高时同体积物体下压深度变化">
      <div className="weight-reference"><span>同体积</span><i>V</i></div>
      <div className="weight-block" style={{ transform: `translateY(${depth}px)` }}><b>ρ</b><small>{level}</small></div>
      <div className="soft-surface">
        <i style={{ width: `${50 + level * 0.55}px`, height: `${5 + level * 0.12}px` }} />
      </div>
      <p>密度提高，同体积下质量增加，下压深度随之增大。</p>
    </div>
  )
}

function BeamAnimation({ level }: { level: number }) {
  const bend = 64 - level * 0.54
  return (
    <div className="demo-stage adjustable-demo modulus-adjustable" aria-label="弹性模量由低到高时材料形变逐渐减弱">
      <svg viewBox="0 0 560 210" role="img">
        <path className="adjustable-support" d="M70 118l-14 22h28l-14-22zm420 0l-14 22h28l-14-22z" />
        <path className="adjustable-beam-shadow" d={`M70 92 Q280 ${92 + bend} 490 92`} />
        <path className="adjustable-beam" d={`M70 88 Q280 ${88 + bend} 490 88`} />
        <path className="adjustable-force" d="M280 25v48m-9-10l9 10 9-10" />
      </svg>
      <p>弹性模量提高，在相同外力下材料形变减小。</p>
    </div>
  )
}

function ThermalAnimation({ level }: { level: number }) {
  const duration = Math.max(0.55, 3.4 - level * 0.028)
  return (
    <div className="demo-stage adjustable-demo thermal-adjustable" aria-label="导热系数由低到高时热量传播速度加快">
      <div className="thermal-source-adjustable">热端</div>
      <div className="thermal-track-adjustable">
        {Array.from({ length: 7 }, (_, index) => (
          <i key={index} style={{ animationDuration: `${duration}s`, animationDelay: `${-index * duration / 7}s` }} />
        ))}
      </div>
      <div className="thermal-target-adjustable">冷端</div>
      <p>导热系数提高，热量从热端传向冷端的速度加快。</p>
    </div>
  )
}

function TensileAnimation({ level }: { level: number }) {
  const width = 44 + level * 0.34
  return (
    <div className="demo-stage adjustable-demo tensile-adjustable" aria-label="拉伸强度由低到高时材料可承受更大拉伸">
      <span className="tensile-arrow-adjustable">←</span>
      <div className="tensile-material-adjustable" style={{ width: `${width}%` }}>
        <i style={{ opacity: Math.max(0, 1 - level / 62) }} />
      </div>
      <span className="tensile-arrow-adjustable">→</span>
      <p>拉伸强度提高，材料可在断裂前承受更大的拉伸载荷。</p>
    </div>
  )
}

function ExpansionAnimation({ level }: { level: number }) {
  const width = 45 + level * 0.38
  return (
    <div className="demo-stage adjustable-demo expansion-adjustable" aria-label="线膨胀系数由低到高时材料受热伸长更明显">
      <div className="expansion-heat-adjustable"><i /><i /><i /></div>
      <div className="expansion-base-line" />
      <div className="expansion-material-adjustable" style={{ width: `${width}%` }}><span>受热材料</span></div>
      <div className="expansion-dimension" style={{ width: `${width}%` }}><i /><i /></div>
      <p>线膨胀系数提高，相同温差下材料伸长更明显。</p>
    </div>
  )
}

export default function ParameterAnimation({ type, name }: { type: string; name: string }) {
  const [level, setLevel] = useState(50)
  const demo = type === 'density' ? <DensityAnimation level={level} />
    : type === 'elastic-modulus' ? <BeamAnimation level={level} />
      : type === 'thermal-conductivity' ? <ThermalAnimation level={level} />
        : type === 'tensile-strength' ? <TensileAnimation level={level} />
          : <ExpansionAnimation level={level} />
  const levelText = level < 34 ? '低' : level < 67 ? '中' : '高'

  return (
    <section className="animation-panel animation-panel--adjustable" aria-labelledby="animation-title">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">DYNAMIC EXPLANATION</p>
          <h2 id="animation-title">参数动态演示</h2>
        </div>
        <ParameterIcon type={type} size={54} animated />
      </div>
      <div className="animation-workbench">
        <div>
          {demo}
          <p className="animation-caption">滑动调节“{name}”的相对高低，观察视觉变化。示意不代表精确物理仿真。</p>
        </div>
        <div className="animation-control">
          <p className="eyebrow">INTERACTIVE CONTROL</p>
          <h3>{name}相对水平</h3>
          <div className="control-value"><strong>{level}</strong><span>/ 100</span><em>{levelText}</em></div>
          <input
            aria-label={`调节${name}相对水平`}
            type="range"
            min="0"
            max="100"
            value={level}
            onChange={(event) => setLevel(Number(event.target.value))}
            style={{ '--slider-level': `${level}%` } as CSSProperties}
          />
          <div className="control-labels"><span>低</span><span>高</span></div>
          <p>拖动滑块，观察参数从低到高时材料表现的变化趋势。</p>
        </div>
      </div>
    </section>
  )
}
