import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/contexts/AuthContext';
import { login } from '@/api/auth';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);

    try {
      const response = await login({ email, password });
      setAuth(response.user, response.token);
      navigate({ to: '/' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-6">
      <div>
        <label htmlFor="email" className="block text-sm font-medium ">
          Email
        </label>
        <input
          type="email"
          id="email"
          aria-label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-gray-900 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium ">
          Password
        </label>
        <input
          type="password"
          id="password"
          aria-label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-gray-900 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="mb-4 text-red-600 text-sm">{error}</div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        aria-label="Sign in to your account"
        className="mt-2 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Signing in…' : 'Login'}
      </button>
    </form>
  );
} 
