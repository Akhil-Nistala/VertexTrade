import axios from "axios";

// Base URL for API calls. In production builds it defaults to "" (same
// origin): Vercel proxies /api to the backend (see vercel.json), which keeps
// the auth cookie first-party so browsers that block third-party cookies
// don't log users out. Locally it points at the backend's port.
export const API_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? "" : "http://localhost:3002");

// withCredentials makes the browser send (and accept) the httpOnly auth
// cookie on cross-origin requests (local dev, or a directly-called API).
export const api = axios.create({ baseURL: `${API_URL}/api/v1`, withCredentials: true });
