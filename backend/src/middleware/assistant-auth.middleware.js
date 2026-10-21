import { ApiError } from '../utils/api-error.js';

const enabled = (value) => value === 'true';

export const assertAssistantConfiguration = (env = process.env) => {
  if (env.NODE_ENV === 'production' && enabled(env.AI_ASSISTANT_DEV_IDENTITY_ENABLED)) {
    throw new Error('Development AI assistant identity cannot be enabled in production.');
  }

  if (
    enabled(env.AI_ASSISTANT_DEV_IDENTITY_ENABLED) &&
    !env.AI_ASSISTANT_DEV_USER_ID?.trim()
  ) {
    throw new Error('AI_ASSISTANT_DEV_USER_ID is required when the development assistant identity is enabled.');
  }
};

export const developmentAssistantAuth = (req, res, next) => {
  assertAssistantConfiguration();

  if (
    process.env.NODE_ENV === 'production' ||
    !enabled(process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED)
  ) {
    return res.status(404).json({
      success: false,
      message: 'Task assistant is not available.',
    });
  }

  const userId = process.env.AI_ASSISTANT_DEV_USER_ID.trim();
  req.assistantIdentity = Object.freeze({ userId });
  return next();
};

export const developmentTaskOwnershipScope = (req, res, next) => {
  assertAssistantConfiguration();

  if (
    process.env.NODE_ENV !== 'production' &&
    enabled(process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED)
  ) {
    req.assistantIdentity = Object.freeze({
      userId: process.env.AI_ASSISTANT_DEV_USER_ID.trim(),
    });
  }
  return next();
};

export const requireAssistantIdentity = (req, res, next) => {
  if (typeof req.assistantIdentity?.userId !== 'string') {
    return next(ApiError.serviceUnavailable('A verified assistant identity is required.'));
  }
  return next();
};

export default developmentAssistantAuth;
