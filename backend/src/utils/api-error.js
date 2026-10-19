/**
 * Custom operational API Error class for consistent REST API error handling.
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Human-readable error message
   * @param {Array<object>|null} [errors=null] - Optional detailed validation or sub-errors
   * @param {boolean} [isOperational=true] - Distinguishes operational errors from programming bugs
   */
  constructor(statusCode, message, errors = null, isOperational = true) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', errors = null) {
    return new ApiError(400, message, errors);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static tooManyRequests(message = 'Too many requests. Please try again later.') {
    return new ApiError(429, message);
  }

  static badGateway(message = 'Bad Gateway: Upstream provider failure.') {
    return new ApiError(502, message);
  }

  static serviceUnavailable(message = 'Service temporarily unavailable.') {
    return new ApiError(503, message);
  }

  static gatewayTimeout(message = 'Gateway Timeout: Upstream request timed out.') {
    return new ApiError(504, message);
  }

  static internal(message = 'Internal Server Error') {
    return new ApiError(500, message, null, false);
  }
}

export default ApiError;
