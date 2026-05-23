import { URLPattern } from 'urlpattern-polyfill'
// Force the polyfill even on Safari which has a partial/buggy native URLPattern
;(globalThis as unknown as Record<string, unknown>).URLPattern = URLPattern
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
