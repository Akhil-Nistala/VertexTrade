import bcrypt from "bcryptjs";

import { User } from "../models/user.model.js";
import { giveStarterPortfolio } from "../data/samplePortfolio.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { clearSessionCookie, setSessionCookie } from "../utils/tokens.js";

const SALT_ROUNDS = 10;

const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email });

// Compared against when the email doesn't exist, so "unknown email" and
// "wrong password" take about the same time and can't be told apart by timing.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("dummy-password-for-timing", SALT_ROUNDS);

const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (await User.exists({ email })) {
    throw new ApiError(409, "An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, passwordHash });

  await giveStarterPortfolio(user._id);

  setSessionCookie(res, user);
  res.status(201).json({ success: true, user: publicUser(user) });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  // Same status and message for both failure cases, so the endpoint can't be
  // used to discover which emails have accounts.
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches) {
    throw new ApiError(401, "Incorrect email or password.");
  }

  setSessionCookie(res, user);
  res.status(200).json({ success: true, user: publicUser(user) });
});

const logout = (req, res) => {
  clearSessionCookie(res);
  res.status(200).json({ success: true, message: "Logged out." });
};

// Lets the dashboard ask "who am I?" on load, since it can't read the
// httpOnly cookie itself.
const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    throw new ApiError(401, "Account not found.");
  }
  res.status(200).json({ success: true, user: publicUser(user) });
});

export { login, logout, me, signup };
