import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './styles.css'

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })

// Do not leave a production service worker controlling local development.
if (import.meta.env.PROD && 'serviceWorker' in navigator) window.addEventListener('load', () => {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
    .then(registration => registration.update()).catch(() => { /* Offline mode is optional. */ })
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}><App /></QueryClientProvider>
  </React.StrictMode>,
)
