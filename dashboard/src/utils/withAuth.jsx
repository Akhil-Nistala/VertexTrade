import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

// Wraps a page so it only renders for a logged-in user; anyone else is sent
// to /login, remembering where they were headed. "Logged in" means the API
// confirmed the session via /auth/me — the token is in an httpOnly cookie,
// so the page can't (and doesn't) inspect it itself.
const withAuth = (WrappedComponent) => {
  const AuthComponent = (props) => {
    const { user, checking } = useAuth();
    const location = useLocation();

    if (checking) {
      return <div className="auth-checking">Loading…</div>;
    }

    if (!user) {
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return <WrappedComponent {...props} />;
  };

  return AuthComponent;
};

export default withAuth;
