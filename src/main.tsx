// src/main.tsx
 import React from 'react'
 import ReactDOM from 'react-dom/client'
 import './index.css'          // 👈  add this line back

 import App from './App.tsx'
 
 ReactDOM.createRoot(document.getElementById('root')!).render(
   <React.StrictMode>
     <App />
   </React.StrictMode>,
 )
