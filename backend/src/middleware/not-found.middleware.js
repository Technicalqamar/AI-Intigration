import { ApiError } from '../utils/api-error.js';

/**
 * 404 Not Found middleware for unmatched routes.
 */
export const notFoundMiddleware = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export default notFoundMiddleware;
