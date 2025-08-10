import './fetch-patch';
// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import './index.css';
import App from './App';
import { AuthProvider, useAuth } from './AuthContext';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TravelsPage from './pages/TravelsPage';
import MobileLayout from './components/MobileLayout';

function ProtectedRoute() {
  const { token } = useAuth();
  const loc = useLocation();
  const isAuthenticated = Boolean(token);
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: loc }} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Layout mobile avec navigation */}
          <Route element={<MobileLayout />}>
            {/* Toutes ces routes nécessitent une auth */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<App />} />
              <Route path="/travels" element={<TravelsPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>
          </Route>

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Enregistrer le service worker pour activer la PWA (cache shell minimal)
serviceWorkerRegistration.register();

