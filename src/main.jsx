import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

try { document.documentElement.dataset.theme = localStorage.getItem('mes-comptes-theme') === 'light' ? 'light' : 'dark' } catch { /* Use the default theme. */ }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
