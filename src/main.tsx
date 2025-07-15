import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './components/App'; // Make sure this is the router-based App!

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
