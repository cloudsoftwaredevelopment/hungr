import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* CRITICAL: basename tells React Router we are in a subdirectory */}
    <BrowserRouter basename="/hungr">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
