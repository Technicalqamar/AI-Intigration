import { randomBytes } from 'node:crypto';
import { Task } from '../models/task.model.js';
import { aiService } from './ai.service.js';
import { ApiError } from '../utils/api-error.js';
import { taskAssistantIntentSchema } from '../validators/task-assistant.validator.js';

const CONFIRMATION_TTL_MS = 5 * 60 * 1000;
const allowedStatuses = ['pending', 'in-progress', 'completed'];

const taskProjection = (task) => ({
  id: String(task._id),
  title: task.title,
  description: task.description || '',
  status: task.status,
  dueDate: task.dueDate || null,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
});

const isOverdue = (task, now) =>
  task.status !== 'completed' &&
  task.dueDate &&
  Number.isFinite(new Date(task.dueDate).getTime()) &&
  new Date(task.dueDate).getTime() < now;

const normalizeTitle = (value) => value.trim().toLocaleLowerCase();

const explicitlyRequests = (message, action) => {
  const patterns = {
    create: /\b(create|add|make|schedule)\s+(?:a\s+)?(?:new\s+)?task\b/i,
    update: /\b(update|change|edit|mark|set|rename)\b[\s\S]*\b(task|to|as)\b/i,
    delete: /\b(delete|remove)\b[\s\S]*\b(task|to-do|todo)\b/i,
  };
  return patterns[action]?.test(message) || false;
};

class TaskAssistantService {
  constructor({ confirmationTtlMs = CONFIRMATION_TTL_MS } = {}) {
    this.confirmationTtlMs = confirmationTtlMs;
    this.pendingDeletions = new Map();
  }

  async handleMessage(userId, message) {
    if (typeof userId !== 'string' || !userId.trim()) {
      throw ApiError.serviceUnavailable('A verified assistant identity is required.');
    }

    const rawIntent = await aiService.parseTaskAssistantIntent(message);
    const result = taskAssistantIntentSchema.safeParse(rawIntent);
    if (!result.success) {
      throw ApiError.badGateway('AI returned an invalid task assistant action.');
    }

    const intent = result.data;
    if (
      ['create', 'update', 'delete'].includes(intent.action) &&
      !explicitlyRequests(message, intent.action)
    ) {
      return {
        message: 'Please state clearly whether you want to create, update, or delete a specific task.',
        action: { type: 'clarify', status: 'not_performed' },
      };
    }

    switch (intent.action) {
      case 'list':
        return this.listTasks(userId, intent.filter);
      case 'count':
        return this.countTasks(userId, intent.filter);
      case 'report':
        return this.reportTasks(userId, intent.filter);
      case 'create':
        return this.createTask(userId, intent);
      case 'update':
        return this.updateTask(userId, intent);
      case 'delete':
        return this.requestDeleteConfirmation(userId, intent);
      case 'clarify':
        return {
          message: intent.question,
          action: { type: 'clarify', status: 'not_performed' },
        };
      default:
        throw ApiError.badGateway('AI returned an unsupported task assistant action.');
    }
  }

  async getOwnedTasks(userId) {
    return this.performDatabaseOperation(() =>
      Task.find({ ownerId: userId }).sort({ createdAt: -1 }).exec()
    );
  }

  async performDatabaseOperation(operation) {
    try {
      return await operation();
    } catch {
      throw new ApiError(500, 'Task assistant could not complete the database operation.');
    }
  }

  filterTasks(tasks, filter = {}) {
    const now = Date.now();
    return tasks.filter((task) => {
      if (filter.status && task.status !== filter.status) return false;
      if (filter.overdue !== undefined && Boolean(isOverdue(task, now)) !== filter.overdue) {
        return false;
      }
      return true;
    });
  }

  async listTasks(userId, filter) {
    const tasks = this.filterTasks(await this.getOwnedTasks(userId), filter);
    return {
      message: tasks.length
        ? `Found ${tasks.length} task${tasks.length === 1 ? '' : 's'} in your workspace.`
        : 'No tasks match that request.',
      action: {
        type: 'list',
        status: 'completed',
        tasks: tasks.map(taskProjection),
      },
    };
  }

  async countTasks(userId, filter) {
    const tasks = await this.getOwnedTasks(userId);
    const selected = this.filterTasks(tasks, filter);
    const now = Date.now();
    const counts = {
      total: selected.length,
      pending: selected.filter((task) => task.status === 'pending').length,
      inProgress: selected.filter((task) => task.status === 'in-progress').length,
      completed: selected.filter((task) => task.status === 'completed').length,
      overdue: selected.filter((task) => isOverdue(task, now)).length,
    };
    return {
      message: `You have ${counts.total} matching task${counts.total === 1 ? '' : 's'}.`,
      action: { type: 'count', status: 'completed', counts },
    };
  }

  async reportTasks(userId, filter) {
    const tasks = this.filterTasks(await this.getOwnedTasks(userId), filter);
    const overdue = tasks.filter((task) => isOverdue(task, Date.now()));
    return {
      message: `Report based on ${tasks.length} task${tasks.length === 1 ? '' : 's'} in your workspace.`,
      action: {
        type: 'report',
        status: 'completed',
        total: tasks.length,
        overdue: overdue.length,
        tasks: tasks.map(taskProjection),
      },
    };
  }

  async createTask(userId, intent) {
    const task = await this.performDatabaseOperation(() => Task.create({
      ownerId: userId,
      title: intent.title,
      description: intent.description || '',
      status: intent.status || 'pending',
      dueDate: intent.dueDate ? new Date(intent.dueDate) : null,
    }));
    return {
      message: `Created task "${task.title}".`,
      action: {
        type: 'create',
        status: 'completed',
        task: taskProjection(task),
      },
    };
  }

  async findOwnedTaskByTitle(userId, taskTitle) {
    const tasks = await this.getOwnedTasks(userId);
    const searchTitle = normalizeTitle(taskTitle);
    const exact = tasks.filter((task) => normalizeTitle(task.title) === searchTitle);
    if (exact.length === 1) return { task: exact[0] };
    if (exact.length > 1) return { matches: exact };

    const partial = tasks.filter((task) => normalizeTitle(task.title).includes(searchTitle));
    if (partial.length === 1) return { task: partial[0] };
    if (partial.length > 1) return { matches: partial };
    return { matches: [] };
  }

  async updateTask(userId, intent) {
    const match = await this.findOwnedTaskByTitle(userId, intent.taskTitle);
    if (!match.task) {
      return {
        message: match.matches.length
          ? 'More than one task matches. Please specify the exact task title; nothing was changed.'
          : 'I could not find a matching task in your workspace; nothing was changed.',
        action: {
          type: 'update',
          status: 'not_performed',
          candidates: (match.matches || []).map(taskProjection),
        },
      };
    }

    const update = { ...intent.updates };
    if (update.dueDate !== undefined) {
      update.dueDate = update.dueDate ? new Date(update.dueDate) : null;
    }
    if (update.status && !allowedStatuses.includes(update.status)) {
      throw ApiError.badRequest('Invalid task status.');
    }

    const task = await this.performDatabaseOperation(() => Task.findOneAndUpdate(
      { _id: match.task._id, ownerId: userId },
      { $set: update },
      { returnDocument: 'after', runValidators: true }
    ));
    if (!task) {
      return {
        message: 'The task changed or is no longer available; nothing was updated.',
        action: { type: 'update', status: 'not_performed' },
      };
    }
    return {
      message: `Updated task "${task.title}".`,
      action: {
        type: 'update',
        status: 'completed',
        task: taskProjection(task),
      },
    };
  }

  async requestDeleteConfirmation(userId, intent) {
    const match = await this.findOwnedTaskByTitle(userId, intent.taskTitle);
    if (!match.task) {
      return {
        message: match.matches.length
          ? 'More than one task matches. Please specify the exact task title; nothing was deleted.'
          : 'I could not find a matching task in your workspace; nothing was deleted.',
        action: {
          type: 'delete',
          status: 'not_performed',
          candidates: (match.matches || []).map(taskProjection),
        },
      };
    }

    const confirmationToken = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + this.confirmationTtlMs;
    this.pendingDeletions.set(confirmationToken, {
      userId,
      taskId: String(match.task._id),
      expiresAt,
    });

    return {
      message: `Confirm deletion of "${match.task.title}". No task has been deleted yet.`,
      action: {
        type: 'delete',
        status: 'confirmation_required',
        confirmationRequired: true,
        confirmation: {
          token: confirmationToken,
          expiresAt: new Date(expiresAt).toISOString(),
          task: {
            id: String(match.task._id),
            title: match.task.title,
          },
        },
      },
    };
  }

  async confirmDelete(userId, confirmationToken) {
    const pending = this.pendingDeletions.get(confirmationToken);
    if (!pending) {
      throw ApiError.badRequest('Delete confirmation is invalid, expired, or already used.');
    }
    if (pending.userId !== userId) {
      throw ApiError.badRequest('Delete confirmation is invalid, expired, or already used.');
    }
    if (pending.expiresAt <= Date.now()) {
      this.pendingDeletions.delete(confirmationToken);
      throw ApiError.badRequest('Delete confirmation is invalid, expired, or already used.');
    }
    this.pendingDeletions.delete(confirmationToken);

    const deletedTask = await this.performDatabaseOperation(() =>
      Task.findOneAndDelete({
        _id: pending.taskId,
        ownerId: userId,
      })
    );
    if (!deletedTask) {
      throw ApiError.notFound('The confirmed task is no longer available in your workspace.');
    }

    return {
      message: `Deleted task "${deletedTask.title}".`,
      action: {
        type: 'delete',
        status: 'completed',
        task: {
          id: String(deletedTask._id),
          title: deletedTask.title,
        },
      },
    };
  }
}

export const taskAssistantService = new TaskAssistantService();
export { CONFIRMATION_TTL_MS };
export { TaskAssistantService };
export default taskAssistantService;
