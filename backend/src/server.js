import "dotenv/config";

import app from "./app.js";
import { connectDB } from "./config/db.js";
import { openMarket } from "./data/market.js";
import { expirePendingOrders } from "./services/matching.service.js";
import { startPriceSimulator } from "./services/priceSimulator.js";

const PORT = process.env.PORT || 3002;

const start = async () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set. Copy .env.example to .env and fill it in.");
  }

  const host = await connectDB(process.env.MONGO_URL);
  console.log(`MongoDB connected: ${host}`);

  await openMarket();
  const expired = await expirePendingOrders();
  if (expired > 0) console.log(`Expired ${expired} pending order(s) from the previous session`);

  app.listen(PORT, () => {
    console.log(`VertexTrade API listening on port ${PORT}`);
  });

  startPriceSimulator();
};

start().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
