import { ApiError } from '../utils/api-error.js';

/**
 * Middleware factory for validating Express request parts using a Zod schema.
 * Supports both Zod 3 (errors) and Zod 4 (issues).
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {'body' | 'params' | 'query'} [source='body'] - Request property to validate
 * @returns {import('express').RequestHandler}
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const dataToValidate = req[source];
    const result = schema.safeParse(dataToValidate);

    if (!result.success) {
      const issues = result.error.issues || result.error.errors || [];
      const formattedErrors = issues.map((err) => ({
        field: err.path.join('.') || source,
        message: err.message,
      }));

      return next(
        new ApiError(
          400,
          `Validation failed for request ${source}.`,
          formattedErrors
        )
      );
    }

    // Safely assign validated/transformed data back
    if (source === 'params') {
      Object.assign(req.params, result.data);
    } else {
      req[source] = result.data;
    }

    next();
  };
};

export default validate;
