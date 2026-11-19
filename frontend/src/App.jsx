import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppRoutes from './routes/AppRoutes';
import Toaster from './components/common/Toast/Toaster';
import RateLimitDialog from './components/common/RateLimitDialog/RateLimitDialog';

import './styles/global.css';
import './styles/shell.css';
import './styles/responsive.css';
import './styles/ui-v2.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
        <RateLimitDialog />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
