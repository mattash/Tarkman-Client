import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      const redirect = `${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}`;
      navigate({ 
        to: '/login',
        search: {
          redirect
        }
      });
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
