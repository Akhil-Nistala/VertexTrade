import mongoose from "mongoose";

// Orders are placed, filled, and cancelled inside transactions, which MongoDB
// only supports on a replica set (or a sharded cluster). Atlas always is one;
// a local mongod has to be started with a replica set name. Failing at
// startup beats failing on the first order.
const assertTransactionsSupported = async () => {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  const isReplicaSet = Boolean(hello.setName);
  const isShardedCluster = hello.msg === "isdbgrid";

  if (!isReplicaSet && !isShardedCluster) {
    throw new Error(
      "MongoDB is running standalone, but orders need transactions. Run it as a replica set " +
        "(see README → Getting started) or use MongoDB Atlas."
    );
  }
};

export const connectDB = async (uri) => {
  if (!uri) {
    throw new Error("MONGO_URL is not set. Copy .env.example to .env and fill it in.");
  }

  const connection = await mongoose.connect(uri);
  await assertTransactionsSupported();
  return connection.connection.host;
};
