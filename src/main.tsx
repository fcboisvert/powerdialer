// src/main.tsx
 import React from 'react'
 import ReactDOM from 'react-dom/client'
 import './index.css';          // keep this line near the top

 import App from './App.tsx'
 
 ReactDOM.createRoot(document.getElementById('root')!).render(
   <React.StrictMode>
     <App />
   </React.StrictMode>,
 )
