import { z } from 'zod';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * Validator schema for MongoDB ObjectId in request URL parameters.
 */
export const taskIdParamSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(OBJECT_ID_REGEX, {
      message: 'Invalid task ID format. Must be a 24-character hexadecimal string.',
    }),
}).strict();

/**
 * Validator schema for creating a new task.
 * Internal fields like _id, __v, createdAt, updatedAt are disallowed via .strict().
 */
export const createTaskSchema = z.object({
  title: z
    .string({
      required_error: 'Task title is required.',
      invalid_type_error: 'Task title must be a string.',
    })
    .trim()
    .min(1, { message: 'Task title cannot be empty.' })
    .max(150, { message: 'Task title cannot exceed 150 characters.' }),

  description: z
    .string({
      invalid_type_error: 'Description must be a string.',
    })
    .trim()
    .max(2000, { message: 'Description cannot exceed 2000 characters.' })
    .optional()
    .default(''),

  status: z
    .enum(['pending', 'in-progress', 'completed'], {
      errorMap: () => ({
        message: "Status must be one of: 'pending', 'in-progress', 'completed'.",
      }),
    })
    .optional()
    .default('pending'),

  dueDate: z
    .union([
      z.string().datetime({ message: 'Due date must be a valid ISO 8601 date string.' }),
      z.string().date({ message: 'Due date must be a valid date string (YYYY-MM-DD).' }),
      z.null(),
    ])
    .optional()
    .transform((val) => (val ? new Date(val) : null)),
}).strict({
  message: 'Request body contains unsupported fields.',
});

/**
 * Validator schema for updating an existing task.
 * Disallows overwriting internal fields like _id, __v, createdAt, updatedAt.
 */
export const updateTaskSchema = z.object({
  title: z
    .string({
      invalid_type_error: 'Task title must be a string.',
    })
    .trim()
    .min(1, { message: 'Task title cannot be empty.' })
    .max(150, { message: 'Task title cannot exceed 150 characters.' })
    .optional(),

  description: z
    .string({
      invalid_type_error: 'Description must be a string.',
    })
    .trim()
    .max(2000, { message: 'Description cannot exceed 2000 characters.' })
    .optional(),

  status: z
    .enum(['pending', 'in-progress', 'completed'], {
      errorMap: () => ({
        message: "Status must be one of: 'pending', 'in-progress', 'completed'.",
      }),
    })
    .optional(),

  dueDate: z
    .union([
      z.string().datetime({ message: 'Due date must be a valid ISO 8601 date string.' }),
      z.string().date({ message: 'Due date must be a valid date string (YYYY-MM-DD).' }),
      z.null(),
    ])
    .optional()
    .transform((val) => (val !== undefined ? (val ? new Date(val) : null) : undefined)),
}).strict({
  message: 'Request body contains unsupported fields.',
}).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: 'At least one field (title, description, status, or dueDate) must be provided for update.',
  }
);
