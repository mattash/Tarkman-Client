import { Link } from "@tanstack/react-router";
import { useAuth } from "~/contexts/AuthContext";
import { LogoutButton } from "./LogoutButton";


export function AuthLink() {
    const auth = useAuth();
    return auth?.user ? (
      <LogoutButton />
    ) : (
      <Link to="/login" className="bg-gray-700 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-400 hover:text-white transition-colors">Login</Link>
    );
  }