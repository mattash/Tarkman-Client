import { createContext, useContext, useState } from 'react';
import type { User } from '@/types/auth';
import { clearAuthToken, getAuthToken, setAuthToken } from '@/utils/authStorage';

interface AuthContextType {
  user: User | null;
  token: string | null;
  setAuth: (user: User | null, token: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface StoredAuth {
  user: User | null;
  token: string | null;
}

function readStoredAuth(): StoredAuth {
  try {
    const savedToken = getAuthToken();
    const savedUser = localStorage.getItem('user');

    if (!savedToken || !savedUser) {
      return { user: null, token: null };
    }

    return {
      token: savedToken,
      user: JSON.parse(savedUser) as User,
    };
  } catch {
    clearStoredAuth();
    return { user: null, token: null };
  }
}

function clearStoredAuth(): void {
  clearAuthToken();
  try {
    localStorage.removeItem('user');
  } catch {
    // The in-memory session is still cleared when storage is unavailable.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [storedAuth, setStoredAuth] = useState<StoredAuth>(readStoredAuth);
  const { user, token } = storedAuth;

  const setAuth = (newUser: User | null, newToken: string | null) => {
    setStoredAuth({ user: newUser, token: newToken });
    if (newUser && newToken) {
      setAuthToken(newToken);
      try {
        localStorage.setItem('user', JSON.stringify(newUser));
      } catch {
        // The current session remains usable even if it cannot be persisted.
      }
    } else {
      clearStoredAuth();
    }
  };

  const logout = () => setAuth(null, null);

  return (
    <AuthContext.Provider value={{ user, token, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 
