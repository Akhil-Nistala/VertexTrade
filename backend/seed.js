// Resets the database and creates a demo account with the sample
// portfolio, so you can log in and see data right after setup.
// Run with: npm run seed
//
//   Email:    demo@vertextrade.dev
//   Password: demo1234

require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const { HoldingsModel } = require("./model/HoldingsModel");
const { PositionsModel } = require("./model/PositionsModel");
const { OrdersModel } = require("./model/OrdersModel");
const { UsersModel } = require("./model/UsersModel");
const { holdings, positions, giveStarterPortfolio } = require("./data/samplePortfolio");

const uri = process.env.MONGO_URL;

const DEMO_USER = { name: "Demo User", email: "demo@vertextrade.dev", password: "demo1234" };

async function seed() {
  if (!uri) {
    console.error("Could not seed: MONGO_URL is not set. Copy .env.example to .env and fill in MONGO_URL.");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
  } catch (err) {
    console.error("Could not connect to MongoDB — check MONGO_URL in .env");
    console.error(err.message);
    process.exit(1);
  }

  await Promise.all([
    HoldingsModel.deleteMany({}),
    PositionsModel.deleteMany({}),
    OrdersModel.deleteMany({}),
    UsersModel.deleteMany({}),
  ]);

  const demo = await UsersModel.create({
    name: DEMO_USER.name,
    email: DEMO_USER.email,
    passwordHash: await bcrypt.hash(DEMO_USER.password, 10),
  });

  await giveStarterPortfolio(demo._id, { HoldingsModel, PositionsModel });

  console.log(
    `Seeded demo user ${DEMO_USER.email} / ${DEMO_USER.password} with ${holdings.length} holdings and ${positions.length} positions.`
  );

  await mongoose.disconnect();
}

seed();
