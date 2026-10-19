const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE_URL = configuredBaseUrl?.replace(/\/+$/, '') || '';

export class ApiClientError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

async function request(path, options = {}) {
  let response;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45000);
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiClientError('The request took too long. Please try again.');
    }
    throw new ApiClientError('Could not reach the Task Manager API. Check that the backend is running.');
  } finally {
    window.clearTimeout(timeout);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError('The API returned an unreadable response.', response.status);
  }

  if (!payload || typeof payload !== 'object') {
    throw new ApiClientError('The API returned an invalid response.', response.status);
  }

  if (!response.ok || payload.success === false) {
    throw new ApiClientError(
      payload.message || `The request failed with status ${response.status}.`,
      response.status
    );
  }

  if (payload.success !== true) {
    throw new ApiClientError('The API response did not confirm success.', response.status);
  }

  return payload;
}

const jsonBody = (value) => JSON.stringify(value);

export const calculateTaskKpis = (tasks) => {
  const now = Date.now();
  return tasks.reduce(
    (totals, task) => {
      totals.totalTasks += 1;
      if (task.status === 'pending') totals.pendingTasks += 1;
      if (task.status === 'in-progress') totals.inProgressTasks += 1;
      if (task.status === 'completed') totals.completedTasks += 1;

      if (
        task.status !== 'completed' &&
        task.dueDate &&
        !Number.isNaN(new Date(task.dueDate).getTime()) &&
        new Date(task.dueDate).getTime() < now
      ) {
        totals.overdueTasks += 1;
      }
      return totals;
    },
    { totalTasks: 0, pendingTasks: 0, inProgressTasks: 0, completedTasks: 0, overdueTasks: 0 }
  );
};

export const taskApi = {
  async list() {
    const result = await request('/api/tasks');
    if (!Array.isArray(result.data)) throw new ApiClientError('The API returned an invalid task list.');
    return result.data;
  },

  async get(id) {
    const result = await request(`/api/tasks/${encodeURIComponent(id)}`);
    if (!result.data || typeof result.data !== 'object') throw new ApiClientError('The API returned an invalid task.');
    return result.data;
  },

  async create(task) {
    const result = await request('/api/tasks', { method: 'POST', body: jsonBody(task) });
    if (!result.data || typeof result.data !== 'object') throw new ApiClientError('The API returned an invalid task.');
    return result.data;
  },

  async update(id, task) {
    const result = await request(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: jsonBody(task),
    });
    if (!result.data || typeof result.data !== 'object') throw new ApiClientError('The API returned an invalid task.');
    return result.data;
  },

  async remove(id) {
    return request(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async planTask({ title, description = '' }) {
    const result = await request('/api/ai/plan-task', {
      method: 'POST',
      body: jsonBody({ mode: 'plan', title: title.trim(), description: description.trim() }),
    });
    const plan = result.plan;
    if (
      !plan ||
      plan.mode !== 'plan' ||
      typeof plan.summary !== 'string' ||
      plan.summary.trim().length === 0 ||
      !['low', 'medium', 'high'].includes(plan.priority) ||
      !Number.isFinite(plan.estimatedHours) ||
      plan.estimatedHours <= 0 ||
      !Array.isArray(plan.steps) ||
      plan.steps.length < 1 ||
      plan.steps.length > 25 ||
      !plan.steps.every((step) => typeof step === 'string' && step.trim().length > 0)
    ) {
      throw new ApiClientError('The AI service returned a plan in an unexpected format.');
    }
    return plan;
  },

  async answerPrompt(prompt) {
    const result = await request('/api/ai/plan-task', {
      method: 'POST',
      body: jsonBody({ mode: 'answer', prompt: prompt.trim() }),
    });
    if (
      result.mode !== 'answer' ||
      typeof result.answer !== 'string' ||
      !result.answer.trim()
    ) {
      throw new ApiClientError('The AI service returned an answer in an unexpected format.');
    }
    return result.answer;
  },
};
