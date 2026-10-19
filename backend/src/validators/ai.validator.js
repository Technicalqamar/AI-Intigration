import { z } from 'zod';

/**
 * Validator schema for the incoming AI plan-task request.
 */
export const aiPlanRequestSchema = z.object({
  description: z
    .string({
      required_error: 'Description is required.',
      invalid_type_error: 'Description must be a string.',
    })
    .trim()
    .min(1, { message: 'Description cannot be empty.' })
    .max(3000, { message: 'Description cannot exceed 3000 characters.' }),
}).strict({
  message: 'Request body contains unsupported fields.',
});

/**
 * Strict validator schema for validating AI-generated plan responses.
 */
export const aiPlanOutputSchema = z.object({
  summary: z
    .string({
      required_error: 'Summary is required in AI response.',
      invalid_type_error: 'Summary must be a string.',
    })
    .trim()
    .min(1, { message: 'Summary cannot be empty.' })
    .max(500, { message: 'Summary cannot exceed 500 characters.' }),

  priority: z.enum(['low', 'medium', 'high'], {
    errorMap: () => ({
      message: "Priority must be one of: 'low', 'medium', or 'high'.",
    }),
  }),

  estimatedHours: z
    .number({
      required_error: 'Estimated hours is required in AI response.',
      invalid_type_error: 'Estimated hours must be a number.',
    })
    .positive({ message: 'Estimated hours must be a positive number greater than zero.' })
    .max(1000, { message: 'Estimated hours cannot exceed 1000.' }),

  steps: z
    .array(
      z
        .string({ invalid_type_error: 'Step item must be a string.' })
        .trim()
        .min(1, { message: 'Step description cannot be empty.' })
        .max(300, { message: 'Step description cannot exceed 300 characters.' }),
      {
        required_error: 'Steps array is required in AI response.',
        invalid_type_error: 'Steps must be an array of strings.',
      }
    )
    .min(1, { message: 'Steps must contain at least one actionable step.' })
    .max(25, { message: 'Steps cannot exceed 25 items.' }),
}).strict();
