import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

// Pathless layout route: renders <Outlet/> for nested <Route> children.
// (Returning `children` would render nothing — Route children are route
// definitions, not React children — blank-screening every wrapped page.)
const RoleRoute = ({ allowedRoles }) => {
  const { user, hasRole, loading } = useAuth();

  if (loading) {
    return null; // Let ProtectedRoute handle spinner
  }

  if (!user || !hasRole(allowedRoles)) {
    // A referring doctor has only their own pages.
    if (user?.role === 'Referrer') return <Navigate to="/referrer" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default RoleRoute;
