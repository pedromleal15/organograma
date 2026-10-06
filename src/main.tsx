import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { StoreProvider } from './state'
import { ThemeProvider } from './theme'

const root = document.querySelector('#root')
if (!root) throw new Error('Root ausente')

if (window.location.pathname === '/') {
  window.history.replaceState({}, '', `/organograma${window.location.search}${window.location.hash}`)
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ThemeProvider>
  </StrictMode>,
)
