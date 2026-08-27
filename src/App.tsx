import { NavLink, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ParameterPage from './pages/ParameterPage'
import DataPage from './pages/DataPage'

export default function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink to="/" className="brand" aria-label="返回首页">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>
            <strong>材料特征基准认知工具</strong>
            <small>Material Feature Benchmark</small>
          </span>
        </NavLink>
        <nav aria-label="主导航">
          <NavLink to="/" end>参数首页</NavLink>
          <NavLink to="/data">数据说明</NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/parameter/:parameterId" element={<ParameterPage />} />
        <Route path="/data" element={<DataPage />} />
      </Routes>
      <footer className="site-footer">
        <span>工业设计工程硕士论文 · 工具原型</span>
        <span>用于设计前期认知辅助，不作为工程选材最终依据</span>
      </footer>
    </div>
  )
}
