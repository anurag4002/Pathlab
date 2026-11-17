import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export const REFERRER_HOME = '/referrer';

// Every staff screen sits behind this. A referring doctor's login has its
// own pages (/referrer) and is sent there - with a short "for lab staff
// only" note when they opened a staff link. The server refuses the staff
// APIs for that login too; this only keeps the screens away.
const StaffRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (user?.role === 'Referrer') {
    const denied = location.pathname !== '/dashboard' && location.pathname !== '/admin' ? location.pathname : '';
    return <Navigate to={REFERRER_HOME} replace state={denied ? { denied } : undefined} />;
  }
  return children;
};

export default StaffRoute;
