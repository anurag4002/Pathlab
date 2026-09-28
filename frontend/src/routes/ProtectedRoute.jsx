import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { LoadingSpinner } from '../components/common';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loader-container" style={{ minHeight: '100vh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  // Preserve the attempted URL so login can return the user where they were
  // headed instead of always dropping them on the dashboard.
  return isAuthenticated ? (
    children
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  );
};

export default ProtectedRoute;
