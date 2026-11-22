// Resets the database and creates a demo account with the sample
// portfolio, so you can log in and see data right after setup.
// Run with: npm run seed
//
//   Email:    demo@vertextrade.dev
//   Password: demo1234

import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { connectDB } from "./config/db.js";
import { User } from "./models/user.model.js";
import { Holding } from "./models/holding.model.js";
import { Position } from "./models/position.model.js";
import { Order } from "./models/order.model.js";
import { Stock } from "./models/stock.model.js";
import { openMarket } from "./data/market.js";
import { giveStarterPortfolio, holdings, positions } from "./data/samplePortfolio.js";

const DEMO_USER = { name: "Demo User", email: "demo@vertextrade.dev", password: "demo1234" };

const seed = async () => {
  await connectDB(process.env.MONGO_URL);

  await Promise.all([
    Holding.deleteMany({}),
    Position.deleteMany({}),
    Order.deleteMany({}),
    User.deleteMany({}),
    Stock.deleteMany({}),
  ]);

  await openMarket();

  const demo = await User.create({
    name: DEMO_USER.name,
    email: DEMO_USER.email,
    passwordHash: await bcrypt.hash(DEMO_USER.password, 10),
  });

  await giveStarterPortfolio(demo._id);

  console.log(
    `Seeded demo user ${DEMO_USER.email} / ${DEMO_USER.password} with ${holdings.length} holdings and ${positions.length} positions.`
  );
};

seed()
  .catch((err) => {
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
