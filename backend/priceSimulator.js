// Lightweight "live market" simulator: every few seconds, nudge each
// Holdings/Positions document's price by a small bounded random percentage
// and recompute a plausible day-change string, so the dashboard's polling
// has something to actually show moving. No-ops gracefully on an empty
// collection or a transient DB hiccup — this is cosmetic, not core logic.

const TICK_INTERVAL_MS = 4000;
const MIN_MOVE_PERCENT = 0.05;
const MAX_MOVE_PERCENT = 0.4;

function randomMovePercent() {
  const magnitude = MIN_MOVE_PERCENT + Math.random() * (MAX_MOVE_PERCENT - MIN_MOVE_PERCENT);
  const direction = Math.random() < 0.5 ? -1 : 1;
  return direction * magnitude;
}

function formatPercent(value) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

async function tickCollection(Model) {
  const docs = await Model.find({});
  if (docs.length === 0) return;

  await Promise.all(
    docs.map((doc) => {
      const movePercent = randomMovePercent();
      const newPrice = Math.max(0.05, doc.price * (1 + movePercent / 100));
      const dayChangePercent = doc.avg ? ((newPrice - doc.avg) / doc.avg) * 100 : movePercent;

      const netChangePercent = doc.avg ? ((newPrice - doc.avg) / doc.avg) * 100 : 0;

      return Model.updateOne(
        { _id: doc._id },
        {
          $set: {
            price: Math.round(newPrice * 100) / 100,
            day: formatPercent(movePercent),
            net: formatPercent(netChangePercent),
            isLoss: dayChangePercent < 0,
          },
        }
      );
    })
  );
}

function startPriceSimulator({ HoldingsModel, PositionsModel }) {
  setInterval(() => {
    tickCollection(HoldingsModel).catch(() => {});
    tickCollection(PositionsModel).catch(() => {});
  }, TICK_INTERVAL_MS);
}

module.exports = { startPriceSimulator, formatPercent };
