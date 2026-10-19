import { Router } from 'express';
import { planTask } from '../controllers/ai.controller.js';
import { aiRateLimiter } from '../middleware/rate-limit.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { aiPlanRequestSchema } from '../validators/ai.validator.js';

const router = Router();

router.post(
  '/plan-task',
  aiRateLimiter,
  validate(aiPlanRequestSchema, 'body'),
  planTask
);

export default router;
