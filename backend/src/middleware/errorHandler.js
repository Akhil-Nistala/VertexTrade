import { ApiError } from "../utils/ApiError.js";

export const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// Single place every error ends up. Known ApiErrors keep their status and
// message; anything else is logged and returned as a generic 500 so internal
// details never leak to the client.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const isKnownError = err instanceof ApiError;
  const statusCode = isKnownError ? err.statusCode : 500;
  const message = isKnownError ? err.message : "Something went wrong";

  if (!isKnownError) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(isKnownError && err.details ? { errors: err.details } : {}),
  });
};
