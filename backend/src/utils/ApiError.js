// An error with an HTTP status attached. Throw one anywhere in a request and
// the central error handler turns it into a JSON response with that status.
export class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}
