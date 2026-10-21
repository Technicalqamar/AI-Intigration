import { taskAssistantService } from '../services/task-assistant.service.js';
import { asyncHandler } from '../utils/async-handler.js';

export const handleTaskAssistantMessage = asyncHandler(async (req, res) => {
  const result = await taskAssistantService.handleMessage(
    req.assistantIdentity.userId,
    req.body.message
  );
  return res.status(200).json({ success: true, assistant: result });
});

export const confirmTaskDeletion = asyncHandler(async (req, res) => {
  const result = await taskAssistantService.confirmDelete(
    req.assistantIdentity.userId,
    req.body.confirmationToken
  );
  return res.status(200).json({ success: true, assistant: result });
});
