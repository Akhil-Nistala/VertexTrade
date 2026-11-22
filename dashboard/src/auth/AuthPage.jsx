import React, { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import Logo from "../components/Logo";
import { useAuth } from "./AuthContext";

import "./Auth.css";

// One component for both forms — `mode` is "login" or "signup".
const AuthPage = ({ mode }) => {
  const isSignup = mode === "signup";

  const { user, checking, login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from || "/";

  if (!checking && user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setError("");
    setSubmitting(true);

    try {
      if (isSignup) {
        await signup(name, email, password);
      } else {
        await login(email, password);
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-logo">
          <Logo size={32} />
        </div>

        <h2>{isSignup ? "Create your account" : "Log in to VertexTrade"}</h2>

        {isSignup && (
          <label>
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>
        )}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={isSignup ? 8 : undefined}
            required
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
        </button>

        <p className="auth-switch">
          {isSignup ? (
            <>
              Already have an account? <Link to="/login">Log in</Link>
            </>
          ) : (
            <>
              New to VertexTrade? <Link to="/signup">Create an account</Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
};

export default AuthPage;
