import { z } from 'zod';

const taskStatusSchema = z.enum(['pending', 'in-progress', 'completed']);
const dueDateSchema = z.string().datetime().nullable();
const taskTitleSchema = z.string().trim().min(1).max(150);
const descriptionSchema = z.string().trim().max(2000).optional().default('');

export const taskAssistantRequestSchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty.').max(3000),
}).strict();

const taskFilterSchema = z.object({
  status: taskStatusSchema.optional(),
  overdue: z.boolean().optional(),
}).strict();

const actionSchemas = [
  z.object({
    action: z.literal('list'),
    filter: taskFilterSchema.optional(),
  }).strict(),
  z.object({
    action: z.literal('count'),
    filter: taskFilterSchema.optional(),
  }).strict(),
  z.object({
    action: z.literal('report'),
    filter: taskFilterSchema.optional(),
  }).strict(),
  z.object({
    action: z.literal('create'),
    title: taskTitleSchema,
    description: descriptionSchema,
    status: taskStatusSchema.optional(),
    dueDate: dueDateSchema.optional(),
  }).strict(),
  z.object({
    action: z.literal('update'),
    taskTitle: taskTitleSchema,
    updates: z.object({
      title: taskTitleSchema.optional(),
      description: z.string().trim().max(2000).optional(),
      status: taskStatusSchema.optional(),
      dueDate: dueDateSchema.optional(),
    }).strict().refine((updates) => Object.keys(updates).length > 0, {
      message: 'At least one task field must be supplied for update.',
    }),
  }).strict(),
  z.object({
    action: z.literal('delete'),
    taskTitle: taskTitleSchema,
  }).strict(),
  z.object({
    action: z.literal('clarify'),
    question: z.string().trim().min(1).max(500),
  }).strict(),
];

export const taskAssistantIntentSchema = z.discriminatedUnion('action', actionSchemas);

export const taskAssistantDeleteConfirmationSchema = z.object({
  confirmationToken: z.string().regex(/^[a-f0-9]{64}$/),
  confirm: z.literal(true),
}).strict();
