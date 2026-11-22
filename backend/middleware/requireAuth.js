const jwt = require("jsonwebtoken");

const AUTH_COOKIE = "token";

// Reads the JWT from the httpOnly cookie, verifies its signature and expiry,
// and exposes the user's id as req.userId. Every data route sits behind this,
// and every query is scoped by req.userId — never by an id the client sends.
function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE];

  if (!token) {
    return res.status(401).json({ message: "Not logged in." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ message: "Session expired — please log in again." });
  }
}

module.exports = { requireAuth, AUTH_COOKIE };
