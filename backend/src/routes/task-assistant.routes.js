import { Router } from 'express';
import {
  confirmTaskDeletion,
  handleTaskAssistantMessage,
} from '../controllers/task-assistant.controller.js';
import { developmentAssistantAuth, requireAssistantIdentity } from '../middleware/assistant-auth.middleware.js';
import { aiRateLimiter } from '../middleware/rate-limit.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  taskAssistantDeleteConfirmationSchema,
  taskAssistantRequestSchema,
} from '../validators/task-assistant.validator.js';

const router = Router();

router.use(developmentAssistantAuth, requireAssistantIdentity, aiRateLimiter);
router.post('/message', validate(taskAssistantRequestSchema, 'body'), handleTaskAssistantMessage);
router.post('/confirm-delete', validate(taskAssistantDeleteConfirmationSchema, 'body'), confirmTaskDeletion);

export default router;
