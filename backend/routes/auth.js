const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { UsersModel } = require("../model/UsersModel");
const { HoldingsModel } = require("../model/HoldingsModel");
const { PositionsModel } = require("../model/PositionsModel");
const { giveStarterPortfolio } = require("../data/samplePortfolio");
const { requireAuth, AUTH_COOKIE } = require("../middleware/requireAuth");

const router = express.Router();

const SALT_ROUNDS = 10;
const SESSION_DAYS = 7;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// httpOnly: page JavaScript can't read the token, so an XSS bug can't steal it.
// sameSite "lax": the browser won't attach it to cross-site POSTs (basic CSRF
// protection). secure: HTTPS-only in production.
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
};

function issueSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: `${SESSION_DAYS}d`,
  });
  res.cookie(AUTH_COOKIE, token, cookieOptions);
}

const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email });

router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ message: "Name is required." });
  }
  if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters." });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();

    if (await UsersModel.exists({ email: normalizedEmail })) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await UsersModel.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
    });

    await giveStarterPortfolio(user._id, { HoldingsModel, PositionsModel });

    issueSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    console.error("Signup failed:", err.message);
    res.status(500).json({ message: "Could not create account." });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "Email and password are required." });
  }

  try {
    const user = await UsersModel.findOne({ email: email.trim().toLowerCase() });

    // Same message whether the email or the password is wrong, so the
    // endpoint doesn't reveal which emails have accounts.
    const passwordMatches = user && (await bcrypt.compare(password, user.passwordHash));
    if (!passwordMatches) {
      return res.status(401).json({ message: "Incorrect email or password." });
    }

    issueSession(res, user);
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error("Login failed:", err.message);
    res.status(500).json({ message: "Could not log in." });
  }
});

router.post("/logout", (req, res) => {
  const { maxAge, ...clearOptions } = cookieOptions;
  res.clearCookie(AUTH_COOKIE, clearOptions);
  res.json({ message: "Logged out." });
});

// Lets the dashboard ask "who am I?" on load, since it can't read the
// httpOnly cookie itself.
router.get("/me", requireAuth, async (req, res) => {
  const user = await UsersModel.findById(req.userId);
  if (!user) {
    return res.status(401).json({ message: "Account not found." });
  }
  res.json({ user: publicUser(user) });
});

module.exports = router;
