import { ApiError } from "../utils/ApiError.js";

// Validates req[source] against a zod schema and replaces it with the parsed
// (trimmed, normalized) data. On failure the first problem becomes the
// message, and every field's errors are included under `errors`.
export const validate = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    const firstMessage = result.error.issues[0]?.message || "Validation failed";
    return next(new ApiError(400, firstMessage, result.error.flatten().fieldErrors));
  }

  req[source] = result.data;
  next();
};
