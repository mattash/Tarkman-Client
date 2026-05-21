import { Link } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { LogoutButton } from "./LogoutButton";


export function AuthLink() {
    const auth = useAuth();
    return auth?.user ? (
      <LogoutButton />
    ) : (
      <Link to="/login" className="bg-tarkman-purple-dark text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-tarkman-purple-light hover:text-white transition-colors inline-flex items-center">Login</Link>
    );
  }