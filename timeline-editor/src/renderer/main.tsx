import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

// Use local monaco-editor package instead of CDN (avoids CSP blocking)
loader.config({ monaco })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
