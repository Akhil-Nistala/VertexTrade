import { ApiError } from "../utils/ApiError.js";
import { AUTH_COOKIE_NAME, verifySessionToken } from "../utils/tokens.js";

// Reads the JWT from the httpOnly cookie, verifies its signature and expiry,
// and exposes the user's id as req.userId. Every data route sits behind this,
// and every query is scoped by req.userId — never by an id the client sends.
export const requireAuth = (req, res, next) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    return next(new ApiError(401, "Not logged in."));
  }

  try {
    req.userId = verifySessionToken(token).sub;
    next();
  } catch {
    next(new ApiError(401, "Session expired — please log in again."));
  }
};
