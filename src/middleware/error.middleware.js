import { ApiError } from '../utils/api-error.js';

/**
 * Centralized application error handling middleware.
 * Ensures consistent JSON response structure and shields internal details in production.
 */
// eslint-disable-next-line no-unused-vars
export const errorMiddleware = (err, req, res, next) => {
  let error = err;

  // Handle malformed JSON body parsed by express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = new ApiError(400, 'Malformed JSON payload in request body.');
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  else if (err.name === 'CastError') {
    const field = err.path || 'id';
    error = new ApiError(400, `Invalid value provided for field '${field}'.`, [
      { field, message: `Cast to ${err.kind} failed for value '${err.value}'` },
    ]);
  }

  // Handle Mongoose ValidationError
  else if (err.name === 'ValidationError') {
    const validationErrors = Object.values(err.errors || {}).map((item) => ({
      field: item.path,
      message: item.message,
    }));
    error = new ApiError(400, 'Database validation failed.', validationErrors);
  }

  // Handle Mongoose duplicate key error (code 11000)
  else if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = new ApiError(400, `Duplicate value entered for unique field: ${field}.`, [
      { field, message: `${field} already exists.` },
    ]);
  }

  // Fallback for unhandled non-ApiError exceptions
  else if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const isProduction = process.env.NODE_ENV === 'production';
    const message = isProduction && statusCode === 500
      ? 'An unexpected internal server error occurred.'
      : error.message || 'Internal Server Error';

    error = new ApiError(statusCode, message, null, false);
  }

  const statusCode = error.statusCode || 500;
  const responsePayload = {
    success: false,
    message: error.message,
  };

  if (Array.isArray(error.errors) && error.errors.length > 0) {
    responsePayload.errors = error.errors;
  }

  // In non-production, attach stack trace for debugging if operational status is false
  if (process.env.NODE_ENV !== 'production' && !error.isOperational && err.stack) {
    responsePayload.stack = err.stack;
  }

  return res.status(statusCode).json(responsePayload);
};

export default errorMiddleware;
