import { Stock } from "../models/stock.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { formatPercent } from "../utils/formatPercent.js";
import { percentChange } from "../utils/money.js";

// Current market quotes for the watchlist.
const getStocks = asyncHandler(async (req, res) => {
  const stocks = await Stock.find({}).sort({ symbol: 1 }).lean();

  res.status(200).json(
    stocks.map(({ symbol, price, open }) => {
      const dayPercent = percentChange(open, price);
      return { symbol, price, day: formatPercent(dayPercent), isDown: dayPercent < 0 };
    })
  );
});

export { getStocks };
