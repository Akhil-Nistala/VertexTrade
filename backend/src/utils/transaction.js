import mongoose from "mongoose";

// Runs `work(session)` inside a MongoDB transaction and returns its result.
// Every read and write that must succeed or fail together takes the session.
// The driver retries `work` on transient errors (e.g. a write conflict with a
// concurrent transaction), so `work` must re-read anything it depends on —
// which it does, because all of its reads happen inside the callback.
export const withTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};
