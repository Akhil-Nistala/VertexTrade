const { Schema } = require("mongoose");

const UsersSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Only the bcrypt hash is ever stored — never the plain password.
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = { UsersSchema };
