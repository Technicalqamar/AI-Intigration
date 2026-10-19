import { z } from 'zod';

const requestTextSchema = (label, maxLength) => z
  .string({
    required_error: `${label} is required.`,
    invalid_type_error: `${label} must be a string.`,
  })
  .trim()
  .min(1, { message: `${label} cannot be empty.` })
  .max(maxLength, { message: `${label} cannot exceed ${maxLength} characters.` });

/**
 * Request validation preserves the legacy { description } planning request.
 * Answer mode accepts either { prompt } or { description }.
 */
export const aiRequestSchema = z.object({
  mode: z.enum(['plan', 'answer'], {
    errorMap: () => ({ message: "Mode must be either 'plan' or 'answer'." }),
  }).optional(),
  title: requestTextSchema('Title', 200).optional(),
  description: requestTextSchema('Description', 3000).optional(),
  prompt: requestTextSchema('Prompt', 3000).optional(),
}).strict({
  message: 'Request body contains unsupported fields.',
}).superRefine((request, context) => {
  const mode = request.mode || 'plan';

  if (mode === 'plan') {
    if (!request.description) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['description'],
        message: 'Description is required for plan mode.',
      });
    }

    if (request.prompt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['prompt'],
        message: 'Use description for plan mode.',
      });
    }

    if (
      request.description &&
      request.title &&
      request.description.length + request.title.length > 3000
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['description'],
        message: 'The combined title and description cannot exceed 3000 characters.',
      });
    }

    return;
  }

  if (request.title) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['title'],
      message: 'Title is only supported in plan mode.',
    });
  }

  if (Boolean(request.prompt) === Boolean(request.description)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['prompt'],
      message: 'Provide exactly one non-empty prompt or description for answer mode.',
    });
  }
});

export const aiPlanRequestSchema = aiRequestSchema;

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

export const aiAnswerOutputSchema = z
  .string({
    invalid_type_error: 'Answer must be a string.',
  })
  .trim()
  .min(1, { message: 'Answer cannot be empty.' })
  .max(12000, { message: 'Answer cannot exceed 12000 characters.' });
