import { apiBaseUrl } from '@/config/environment';
import type { AuthResponse, LoginCredentials } from '@/types/auth';

const API_BASE = apiBaseUrl;

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/users/sign_in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ user: credentials }),
  });

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      throw new Error(`Login failed (${response.status})`);
    }

    const error = errorBody as { error?: string };
    throw new Error(error.error || 'Login failed');
  }

  const data = await response.json();
  
  // Check headers for token if not in body
  if (!data.token) {
    const authHeader = response.headers.get('Authorization');
    const xAuthToken = response.headers.get('x-auth-token');
    
    if (authHeader?.startsWith('Bearer ')) {
      data.token = authHeader.substring(7);
    } else if (xAuthToken) {
      data.token = xAuthToken;
    }
  }

  return data;
}

export async function logout(token: string): Promise<void> {
  const response = await fetch(`${API_BASE}/users/sign_out`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Logout failed');
}
