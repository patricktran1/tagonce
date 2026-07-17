import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { NetworkStatus } from './components/NetworkStatus'
import { prepareProductPolish } from './lib/productPolish'
import { registerTagOnceServiceWorker } from './lib/pwa'

prepareProductPolish()
registerTagOnceServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <NetworkStatus />
  </StrictMode>,
)
