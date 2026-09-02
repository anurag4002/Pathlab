import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const RoleRoute = ({ children, allowedRoles }) => {
  const { user, hasRole, loading } = useAuth();

  if (loading) {
    return null; // Let ProtectedRoute handle spinner
  }

  if (!user || !hasRole(allowedRoles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default RoleRoute;
