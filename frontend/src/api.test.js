import { afterEach, describe, expect, it, vi } from 'vitest';
import { assistantApi, taskApi } from './api.js';

const mockResponse = (payload, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: vi.fn().mockResolvedValue(payload),
});

describe('frontend API contracts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the backend assistant message and delete confirmation contracts', async () => {
    const assistant = {
      message: 'A task needs confirmation.',
      action: {
        type: 'delete',
        status: 'confirmation_required',
        confirmation: { token: 'a'.repeat(64), task: { id: 'task-1', title: 'Old task' } },
      },
    };
    const fetch = vi.fn()
      .mockResolvedValueOnce(mockResponse({ success: true, assistant }))
      .mockResolvedValueOnce(mockResponse({
        success: true,
        assistant: {
          message: 'Deleted task "Old task".',
          action: { type: 'delete', status: 'completed', task: { id: 'task-1', title: 'Old task' } },
        },
      }));
    vi.stubGlobal('fetch', fetch);

    await expect(assistantApi.sendMessage(' Delete Old task ')).resolves.toEqual(assistant);
    await expect(assistantApi.confirmDelete('a'.repeat(64))).resolves.toMatchObject({
      action: { type: 'delete', status: 'completed' },
    });

    expect(fetch.mock.calls.map(([url, options]) => [url, options.method, JSON.parse(options.body)])).toEqual([
      ['/api/ai/assistant/message', 'POST', { message: 'Delete Old task' }],
      ['/api/ai/assistant/confirm-delete', 'POST', { confirmationToken: 'a'.repeat(64), confirm: true }],
    ]);
  });

  it('uses the existing planner and answer request contracts', async () => {
    const plan = {
      mode: 'plan',
      summary: 'Prepare the launch',
      priority: 'medium',
      estimatedHours: 2,
      steps: ['Review requirements'],
    };
    const fetch = vi.fn()
      .mockResolvedValueOnce(mockResponse({ success: true, plan }))
      .mockResolvedValueOnce(mockResponse({ success: true, plan }))
      .mockResolvedValueOnce(mockResponse({ success: true, mode: 'answer', answer: 'A clear answer.' }));
    vi.stubGlobal('fetch', fetch);

    await expect(taskApi.planTask({ description: ' Prepare launch ' })).resolves.toEqual(plan);
    await expect(taskApi.planTask({ title: 'Standalone title' })).resolves.toEqual(plan);
    await expect(taskApi.answerPrompt(' What should I do? ')).resolves.toBe('A clear answer.');
    expect(fetch.mock.calls.map(([url, options]) => [url, JSON.parse(options.body)])).toEqual([
      ['/api/ai/plan-task', { mode: 'plan', description: 'Prepare launch' }],
      ['/api/ai/plan-task', { mode: 'plan', title: 'Standalone title', description: 'Standalone title' }],
      ['/api/ai/plan-task', { mode: 'answer', prompt: 'What should I do?' }],
    ]);
  });

  it('rejects an empty task plan before making an API request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await expect(taskApi.planTask({ title: '  ', description: ' ' })).rejects.toMatchObject({
      message: 'Add a task title or description before requesting a plan.',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not interpret unsuccessful backend responses as successful assistant actions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({
      success: false,
      message: 'AI provider unavailable.',
    }, { ok: false, status: 502 })));

    await expect(assistantApi.sendMessage('List my tasks')).rejects.toMatchObject({
      message: 'AI provider unavailable.',
      status: 502,
    });
  });
});
