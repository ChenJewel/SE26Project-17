/**
 * React 挂载入口。
 *
 * 只负责把 App 渲染到 index.html 的 #root，并引入全局样式。
 * 页面逻辑和共享状态不要放在这里，统一从 App.tsx 往下分发。
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
