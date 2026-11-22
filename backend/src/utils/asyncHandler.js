// Express 4 doesn't catch rejected promises from async handlers — the request
// would just hang. This forwards any thrown error to the error handler.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
