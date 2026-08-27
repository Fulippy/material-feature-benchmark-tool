import dataReport from '../data/public_data_report.json'
import DataNotice from '../components/DataNotice'

export default function DataPage() {
  return (
    <main className="data-page page-width">
      <section className="data-page__hero">
        <p className="eyebrow">DATA & BOUNDARIES</p>
        <h1>数据说明</h1>
        <p>明确数据来源、表达方式与工具边界，帮助使用者正确理解尺度图中的材料区间。</p>
      </section>

      <section className="data-metrics" aria-label="数据处理概览">
        <div><strong>{dataReport.parsedParameterCount}</strong><span>成功解析参数</span></div>
        <div><strong>{dataReport.uniqueMaterialCount}</strong><span>唯一基准材料</span></div>
        <div><strong>{dataReport.matchedMaterialCount}</strong><span>已匹配案例的材料</span></div>
        <div><strong>{dataReport.copiedImageCount}</strong><span>已复制本地案例图片</span></div>
      </section>

      <section className="data-sections">
        <article>
          <span>01</span>
          <div><h2>材料参数数据</h2><p>数据来自第三章形成的材料参数—基准材料映射表。参数主轴、材料名称、类别及区间均由本地工作簿转换生成。</p></div>
        </article>
        <article>
          <span>02</span>
          <div><h2>应用案例数据</h2><p>应用案例来自设计奖产品材料提及数据。案例按完全匹配、包含匹配和轻度模糊匹配依次查找，每种材料最多保留 20 条。</p></div>
        </article>
        <article>
          <span>03</span>
          <div><h2>区间表达</h2><p>材料参数以区间形式表达，而非单一固定值。尺度表只把横向数值轴作为真实变量，斜向高度仅表达由低到高的视觉趋势。</p></div>
        </article>
        <article>
          <span>04</span>
          <div><h2>参数波动</h2><p>不同牌号、配方、制造工艺、温度、湿度与材料形态可能导致参数变化，页面区间不能替代具体材料规格书。</p></div>
        </article>
        <article>
          <span>05</span>
          <div><h2>工具用途</h2><p>本工具面向工业设计前期的材料参数认知与基准参照，用于帮助理解抽象参数，不构成工程选材建议。</p></div>
        </article>
        <article>
          <span>06</span>
          <div><h2>使用边界</h2><p>涉及结构安全、热设计、耐久性或量产验证时，应结合材料牌号、测试条件、供应商数据与工程计算进一步判断。</p></div>
        </article>
      </section>

      <section className="processing-note">
        <div>
          <p className="eyebrow">PROCESSING NOTE</p>
          <h2>本次数据转换记录</h2>
        </div>
        <ul>
          <li>{dataReport.parsedMaterialTotal} 条参数—材料记录成功解析。</li>
          <li>{dataReport.imageReadFailureCount} 条本地图片路径不可读取，页面使用灰色占位图。</li>
          <li>{dataReport.clippedIntervalCount} 个材料区间越过主轴边界，尺度表按边界裁切。</li>
          <li>{dataReport.unmatchedMaterials.length ? `${dataReport.unmatchedMaterials.join('、')} 暂未匹配到案例。` : '所有材料均已匹配到案例。'}</li>
        </ul>
      </section>
      <DataNotice />
    </main>
  )
}
