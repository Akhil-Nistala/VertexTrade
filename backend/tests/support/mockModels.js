import { fileURLToPath } from "node:url";

import { jest } from "@jest/globals";

// Absolute paths, so mocks register the same way whichever test file calls this.
const src = (path) => fileURLToPath(new URL(`../../src/${path}`, import.meta.url));

// Shared model mocks for unit tests. Call mockModels() before importing any
// app code. Transactions run the callback straight away with a fake session,
// so tests can assert that every write was made with that session (i.e.
// inside the transaction). Real transactional behaviour — atomicity, races —
// is covered by the integration tests against a replica set.

export const SESSION = { id: "test-session" };

// A chainable stand-in for a Mongoose query: supports .sort(), .lean(), and
// being awaited directly.
export const query = (result) => ({
  sort: () => query(result),
  lean: () => Promise.resolve(result),
  then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
});

export const mockModels = () => {
  const models = {
    Holding: {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      create: jest.fn(),
      deleteOne: jest.fn(),
      updateOne: jest.fn(),
    },
    Position: { find: jest.fn() },
    Order: { find: jest.fn(), findOne: jest.fn(), findOneAndUpdate: jest.fn(), create: jest.fn() },
    Stock: { find: jest.fn(), findOne: jest.fn() },
    User: { findById: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() },
  };

  jest.unstable_mockModule(src("models/holding.model.js"), () => ({ Holding: models.Holding }));
  jest.unstable_mockModule(src("models/position.model.js"), () => ({ Position: models.Position }));
  jest.unstable_mockModule(src("models/order.model.js"), () => ({
    Order: models.Order,
    ORDER_MODES: ["BUY", "SELL"],
    ORDER_TYPES: ["MARKET", "LIMIT"],
    ORDER_STATUSES: ["PENDING", "FILLED", "CANCELLED", "EXPIRED"],
  }));
  jest.unstable_mockModule(src("models/stock.model.js"), () => ({ Stock: models.Stock }));
  jest.unstable_mockModule(src("models/user.model.js"), () => ({
    User: models.User,
    STARTING_CASH: 100000,
  }));
  jest.unstable_mockModule(src("utils/transaction.js"), () => ({
    withTransaction: (work) => work(SESSION),
  }));

  return models;
};

// Sensible defaults for a fresh test: Order.create echoes what it was given.
export const resetModels = (models) => {
  jest.clearAllMocks();
  models.Order.create.mockImplementation(async ([fields]) => [{ _id: "o1", ...fields }]);
  models.User.findById.mockResolvedValue({ cash: 100000, reservedCash: 0 });
};
