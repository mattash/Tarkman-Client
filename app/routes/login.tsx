import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/LoginForm';
import { useEffect } from 'react';
import { getSafeRedirectPath } from '@/utils/authRedirect';

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  
  useEffect(() => {
    if (user) {
      navigate({ to: getSafeRedirectPath(redirect), replace: true });
    }
  }, [user, navigate, redirect]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 sm:px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold">
          Sign in to your account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <LoginForm redirectTo={redirect} />
        </div>
      </div>
    </div>
  );
} 
