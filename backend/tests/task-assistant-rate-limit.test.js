import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED = 'true';
process.env.AI_ASSISTANT_DEV_USER_ID = 'task-assistant-rate-limit-test-user';
process.env.AI_RATE_LIMIT_WINDOW_MS = '60000';
process.env.AI_RATE_LIMIT_MAX = '2';

const [{ default: app }, { aiService }] = await Promise.all([
  import('../src/app.js'),
  import('../src/services/ai.service.js'),
]);

const originalParseIntent = aiService.parseTaskAssistantIntent;
const originalGetGroqClient = aiService.getGroqClient;

after(() => {
  aiService.parseTaskAssistantIntent = originalParseIntent;
  aiService.getGroqClient = originalGetGroqClient;
  delete process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED;
  delete process.env.AI_ASSISTANT_DEV_USER_ID;
  delete process.env.AI_RATE_LIMIT_WINDOW_MS;
  delete process.env.AI_RATE_LIMIT_MAX;
});

describe('Task assistant rate limit responses', () => {
  it('keeps provider quota errors distinct from the application IP limit', async () => {
    aiService.parseTaskAssistantIntent = async () => ({
      action: 'clarify',
      question: 'Please clarify your task request.',
    });

    const accepted = await request(app)
      .post('/api/ai/assistant/message')
      .send({ message: 'Show my tasks.' });
    assert.strictEqual(accepted.status, 200);

    aiService.parseTaskAssistantIntent = originalParseIntent;
    aiService.getGroqClient = () => ({
      chat: {
        completions: {
          create: async () => {
            throw Object.assign(new Error('provider quota details'), { status: 429 });
          },
        },
      },
    });

    const providerLimited = await request(app)
      .post('/api/ai/assistant/message')
      .send({ message: 'Create a task to review the report.' });
    assert.strictEqual(providerLimited.status, 429);
    assert.strictEqual(
      providerLimited.body.message,
      'AI service rate limit reached with provider. Please try again shortly.'
    );

    const applicationLimited = await request(app)
      .post('/api/ai/assistant/message')
      .send({ message: 'Show my tasks again.' });
    assert.strictEqual(applicationLimited.status, 429);
    assert.strictEqual(
      applicationLimited.body.message,
      'Too many AI requests from this IP. Please try again later.'
    );
  });
});
