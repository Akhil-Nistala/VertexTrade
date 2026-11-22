module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setup.js"],
  // Integration tests need a MongoDB replica set: npm run test:integration
  testPathIgnorePatterns: ["/node_modules/", "/tests/integration/"],
};
