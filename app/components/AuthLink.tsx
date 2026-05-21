import { Link } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { LogoutButton } from "./LogoutButton";

const authLinkClassName =
  "bg-transparent text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-tarkman-purple-light hover:text-white transition-colors inline-flex items-center";
const activeAuthLinkClassName = "font-bold underline underline-offset-4 text-white";

export function AuthLink() {
    const auth = useAuth();
    return auth?.user ? (
      <LogoutButton />
    ) : (
      <Link to="/login" className={authLinkClassName} activeProps={{ className: activeAuthLinkClassName }}>Login</Link>
    );
  }
