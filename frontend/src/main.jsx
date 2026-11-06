import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { applyUiVersion } from './utils/uiVersion';

// Classic or New UI, chosen per user (user menu / dashboard banner).
applyUiVersion();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
