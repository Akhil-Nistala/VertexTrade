import jwt from "jsonwebtoken";

export const AUTH_COOKIE_NAME = "token";
const SESSION_DAYS = 7;

export const signSessionToken = (user) =>
  jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: `${SESSION_DAYS}d`,
  });

export const verifySessionToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

// httpOnly: page JavaScript can't read the token, so an XSS bug can't steal it.
// sameSite "lax": the browser won't attach it to cross-site POSTs (basic CSRF
// protection). secure: HTTPS-only in production.
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
});

export const setSessionCookie = (res, user) =>
  res.cookie(AUTH_COOKIE_NAME, signSessionToken(user), {
    ...cookieOptions(),
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });

export const clearSessionCookie = (res) => res.clearCookie(AUTH_COOKIE_NAME, cookieOptions());
