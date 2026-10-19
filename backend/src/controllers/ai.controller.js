import { aiService } from '../services/ai.service.js';
import { asyncHandler } from '../utils/async-handler.js';

/**
 * @desc    Generate an actionable AI task breakdown plan from a description
 * @route   POST /api/ai/plan-task
 * @access  Public
 */
export const planTask = asyncHandler(async (req, res) => {
  const { mode = 'plan', title, description, prompt } = req.body;

  if (mode === 'answer') {
    const answer = await aiService.generateAnswer(prompt || description);
    return res.status(200).json({
      success: true,
      mode,
      answer,
    });
  }

  const plan = await aiService.generateTaskPlan({ title, description });

  return res.status(200).json({
    success: true,
    plan,
  });
});
