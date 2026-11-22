import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";

// withCredentials makes the browser send (and accept) the httpOnly auth
// cookie on these cross-origin requests to the API.
export const api = axios.create({ baseURL: API_URL, withCredentials: true });
