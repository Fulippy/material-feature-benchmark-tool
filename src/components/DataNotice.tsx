export default function DataNotice({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={`data-notice${compact ? ' data-notice--compact' : ''}`}>
      <span className="data-notice__icon" aria-hidden="true">i</span>
      <div>
        <strong>数据使用说明</strong>
        <p>材料参数以区间形式表达。不同牌号、配方、工艺与材料形态可能造成实际数值波动，本工具仅用于设计前期认知辅助。</p>
      </div>
    </aside>
  )
}
