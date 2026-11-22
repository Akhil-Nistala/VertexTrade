import { useEffect } from "react";

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || "http://localhost:5174";
const SIGNUP_URL = `${DASHBOARD_URL}/signup`;

// Account creation lives in the dashboard app (it talks to the auth API and
// holds the session), so this route just forwards there.
function Signup() {
  useEffect(() => {
    window.location.replace(SIGNUP_URL);
  }, []);

  return (
    <div className="container p-5 text-center">
      <p className="text-muted">
        Redirecting to sign up… <a href={SIGNUP_URL}>Continue</a>
      </p>
    </div>
  );
}

export default Signup;
