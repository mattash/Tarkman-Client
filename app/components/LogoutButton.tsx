import { useAuth } from '@/contexts/AuthContext';
import { logout } from '@/api/auth';
import { getAuthToken } from '@/utils/authStorage';

export function LogoutButton() {
  const { logout: logoutContext } = useAuth();

  const handleLogout = async () => {
    try {
      const token = getAuthToken();
      if (token) {
        await logout(token);
      }
      logoutContext();
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear local auth state even if API call fails
      logoutContext();
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="bg-transparent text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-tarkman-purple-light hover:text-white transition-colors inline-flex items-center"
    >
      Sign Out
    </button>
  );
}
