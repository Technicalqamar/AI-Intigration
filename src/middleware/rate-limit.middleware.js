import rateLimit from 'express-rate-limit';

/**
 * Rate limiter middleware specifically targeting AI planning operations to protect quota.
 */
export const createAiRateLimiter = (options = {}) => {
  const windowMs =
    options.windowMs !== undefined
      ? options.windowMs
      : parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '900000', 10);

  const max =
    options.max !== undefined
      ? options.max
      : parseInt(process.env.AI_RATE_LIMIT_MAX || '10', 10);

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: 'Too many AI planning requests from this IP. Please try again later.',
      });
    },
    ...options,
  });
};

export const aiRateLimiter = createAiRateLimiter();

export default aiRateLimiter;
