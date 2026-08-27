import { Link } from 'react-router-dom'
import rawData from '../data/materials_mapping.json'
import DataNotice from '../components/DataNotice'
import ParameterCard from '../components/ParameterCard'
import type { MaterialsMapping } from '../types'

const data = rawData as MaterialsMapping

export default function HomePage() {
  const materialCount = new Set(data.parameters.flatMap((parameter) => parameter.materials.map((material) => material.name))).size

  return (
    <main>
      <section className="home-hero">
        <div className="hero-grid" aria-hidden="true" />
        <div className="home-hero__content">
          <p className="eyebrow hero-eyebrow"><span /> MATERIAL COGNITION PROTOTYPE</p>
          <h1>材料特征<br /><em>基准认知工具</em></h1>
          <p className="hero-lead">通过常见基准材料帮助设计师理解抽象材料参数。</p>
          <p className="hero-description">从参数简介、动态演示到斜向尺度与产品案例，在真实数值区间中建立“参数—材料—应用”的认知联系。</p>
          <div className="hero-actions">
            <a href="#parameters" className="primary-button large">选择参数</a>
            <Link to="/data" className="secondary-button large">了解数据范围</Link>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-axis">
            <i /><i /><i /><i /><i />
            <span className="hero-axis__line" />
            <b className="hero-node hero-node--1">ρ</b>
            <b className="hero-node hero-node--2">E</b>
            <b className="hero-node hero-node--3">λ</b>
            <b className="hero-node hero-node--4">σ</b>
            <b className="hero-node hero-node--5">α</b>
          </div>
          <div className="hero-note"><span>01</span>真实数值轴</div>
          <div className="hero-note hero-note--2"><span>02</span>基准材料区间</div>
          <div className="hero-note hero-note--3"><span>03</span>应用语境</div>
        </div>
        <div className="hero-stats">
          <div><strong>{data.parameters.length}</strong><span>材料参数</span></div>
          <div><strong>{materialCount}</strong><span>唯一基准材料</span></div>
          <div><strong>区间</strong><span>参数表达方式</span></div>
        </div>
      </section>

      <section className="parameter-index" id="parameters">
        <div className="index-intro">
          <div>
            <p className="eyebrow">CHOOSE A PARAMETER</p>
            <h2>选择一个参数开始认知</h2>
          </div>
          <p>每个参数都配有独立的图形解释、轻量动态演示、斜向数值尺度和基准材料案例。</p>
        </div>
        <div className="parameter-grid">
          {data.parameters.map((parameter, index) => (
            <ParameterCard key={parameter.id} parameter={parameter} index={index} />
          ))}
        </div>
      </section>

      <section className="workflow-strip">
        <p className="eyebrow">COGNITIVE PATH</p>
        <h2>从抽象数值到材料语境</h2>
        <div>
          <article><span>01</span><h3>理解参数</h3><p>通过简明定义与动态演示识别参数含义及变化方向。</p></article>
          <article><span>02</span><h3>定位材料</h3><p>在真实横向数值轴中观察常见材料所处的参数区间。</p></article>
          <article><span>03</span><h3>联系应用</h3><p>选择基准材料，查看真实产品中的材料使用语境。</p></article>
        </div>
      </section>
      <div className="page-width"><DataNotice compact /></div>
    </main>
  )
}
