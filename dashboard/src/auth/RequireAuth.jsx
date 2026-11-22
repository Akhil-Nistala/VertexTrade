import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "./AuthContext";

// Route guard: renders the page only for a logged-in user, otherwise sends
// them to /login and remembers where they were headed.
const RequireAuth = ({ children }) => {
  const { user, checking } = useAuth();
  const location = useLocation();

  if (checking) {
    return <div className="auth-checking">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default RequireAuth;
