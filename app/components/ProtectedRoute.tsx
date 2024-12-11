import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuth } from '~/contexts/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate({ 
        to: '/login',
        search: {
          redirect: window.location.pathname
        }
      });
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  return <>{children}</>;
} 