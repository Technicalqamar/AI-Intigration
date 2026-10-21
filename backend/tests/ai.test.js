import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import express from 'express';
import request from 'supertest';

import errorMiddleware from '../src/middleware/error.middleware.js';
import { aiService } from '../src/services/ai.service.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalAiRateLimitMax = process.env.AI_RATE_LIMIT_MAX;
process.env.NODE_ENV = 'test';
process.env.AI_RATE_LIMIT_MAX = '50';

const [{ default: app }, { createAiRateLimiter }] = await Promise.all([
  import('../src/app.js'),
  import('../src/middleware/rate-limit.middleware.js'),
]);

const mockPlan = {
  summary: 'Build and launch a personal portfolio website within 3 days.',
  priority: 'high',
  estimatedHours: 12,
  steps: [
    'Plan website structure and content inventory',
    'Design and build responsive layout',
    'Add featured projects and contact form',
    'Test cross-browser compatibility and deploy',
  ],
};

const mockGroqClient = (create) => ({
  chat: {
    completions: { create },
  },
});

const completionWithContent = (content) => ({
  choices: [{ message: { content } }],
});

const providerError = (message, status, name) => {
  const error = new Error(message);
  if (status !== undefined) error.status = status;
  if (name) error.name = name;
  return error;
};

describe('AI Task Planning Endpoint (POST /api/ai/plan-task)', () => {
  let originalGetGroqClient;
  let originalApiKey;
  let originalModel;

  before(() => {
    originalGetGroqClient = aiService.getGroqClient;
    originalApiKey = process.env.GROQ_API_KEY;
    originalModel = process.env.GROQ_MODEL;
  });

  after(() => {
    aiService.getGroqClient = originalGetGroqClient;
    if (originalApiKey === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = originalApiKey;
    }
    if (originalModel === undefined) {
      delete process.env.GROQ_MODEL;
    } else {
      process.env.GROQ_MODEL = originalModel;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalAiRateLimitMax === undefined) {
      delete process.env.AI_RATE_LIMIT_MAX;
    } else {
      process.env.AI_RATE_LIMIT_MAX = originalAiRateLimitMax;
    }
  });

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'gsk_mock_test_key';
    process.env.GROQ_MODEL = 'openai/gpt-oss-20b';
    aiService.getGroqClient = () => mockGroqClient(async () =>
      completionWithContent(JSON.stringify(mockPlan))
    );
  });

  afterEach(() => {
    aiService.getGroqClient = originalGetGroqClient;
  });

  describe('Request validation', () => {
    it('should reject requests with missing description', async () => {
      const res = await request(app).post('/api/ai/plan-task').send({});
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some((error) => error.field === 'description'));
    });

    it('should reject requests with empty or whitespace description', async () => {
      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ description: '   ' });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some((error) => error.field === 'description'));
    });

    it('should reject descriptions longer than 3000 characters', async () => {
      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ description: 'a'.repeat(3001) });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some((error) => error.field === 'description'));
    });

    it('should reject requests containing unsupported fields', async () => {
      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ description: 'Valid description', unsupportedParam: true });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('should reject unsupported modes', async () => {
      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ mode: 'summarize', description: 'A valid request.' });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('should reject missing answer prompts and non-string prompts', async () => {
      const missingPrompt = await request(app)
        .post('/api/ai/plan-task')
        .send({ mode: 'answer' });
      const invalidPrompt = await request(app)
        .post('/api/ai/plan-task')
        .send({ mode: 'answer', prompt: 42 });

      assert.strictEqual(missingPrompt.status, 400);
      assert.strictEqual(invalidPrompt.status, 400);
    });

    it('should reject excessively long answer prompts', async () => {
      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ mode: 'answer', prompt: 'a'.repeat(3001) });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('should reject a combined title and description longer than the limit', async () => {
      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({
          mode: 'plan',
          title: 'a'.repeat(200),
          description: 'b'.repeat(2801),
        });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });
  });

  describe('Successful planning with mocked Groq response', () => {
    it('should return the plan contract and send the configured model to Groq', async () => {
      let requestOptions;
      let sdkOptions;
      aiService.getGroqClient = () => mockGroqClient(async (options, config) => {
        requestOptions = options;
        sdkOptions = config;
        return completionWithContent(JSON.stringify(mockPlan));
      });

      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ description: 'Build a portfolio website in three days.' });

      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.body, {
        success: true,
        plan: { mode: 'plan', ...mockPlan },
      });
      assert.strictEqual(requestOptions.model, 'openai/gpt-oss-20b');
      assert.deepStrictEqual(requestOptions.response_format, { type: 'json_object' });
      assert.strictEqual(sdkOptions.timeout, 20000);
    });

    it('should include an optional title and explicit plan mode in the provider request', async () => {
      let requestOptions;
      aiService.getGroqClient = () => mockGroqClient(async (options) => {
        requestOptions = options;
        return completionWithContent(JSON.stringify(mockPlan));
      });

      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({
          mode: 'plan',
          title: 'Complete my Node.js assignment',
          description: 'Build the API and test all endpoints.',
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.plan.mode, 'plan');
      assert.strictEqual(
        requestOptions.messages[1].content,
        'Title: Complete my Node.js assignment\nDescription: Build the API and test all endpoints.'
      );
    });

    it('should accept a goal as the plan description without requiring a separate title', async () => {
      const goal = 'Prepare the product launch and coordinate the release.';
      let requestOptions;
      aiService.getGroqClient = () => mockGroqClient(async (options) => {
        requestOptions = options;
        return completionWithContent(JSON.stringify(mockPlan));
      });

      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ mode: 'plan', description: goal });

      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.body, {
        success: true,
        plan: { mode: 'plan', ...mockPlan },
      });
      assert.strictEqual(requestOptions.messages[1].content, goal);
    });
  });

  describe('Direct answer mode', () => {
    it('should return a direct answer rather than planning steps', async () => {
      const answer = 'Express middleware processes requests in the pipeline; controllers implement endpoint behavior.';
      let requestOptions;
      aiService.getGroqClient = () => mockGroqClient(async (options) => {
        requestOptions = options;
        return completionWithContent(answer);
      });

      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ mode: 'answer', prompt: 'Explain middleware and controllers.' });

      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.body, { success: true, mode: 'answer', answer });
      assert.strictEqual(requestOptions.messages[1].content, 'Explain middleware and controllers.');
      assert.match(requestOptions.messages[0].content, /actual request directly/i);
      assert.strictEqual('response_format' in requestOptions, false);
    });

    it('should answer a request for 15 unique boys’ names with the names themselves', async () => {
      const names = [
        'Liam', 'Noah', 'Oliver', 'Elijah', 'James',
        'Henry', 'Theodore', 'Ezra', 'Milo', 'Kai',
        'Arlo', 'Jasper', 'Finn', 'Leo', 'Rowan',
      ];
      const answer = names.map((name, index) => `${index + 1}. ${name}`).join('\n');
      aiService.getGroqClient = () => mockGroqClient(async () =>
        completionWithContent(answer)
      );

      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ mode: 'answer', prompt: "Give me 15 unique boys' names." });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.mode, 'answer');
      assert.strictEqual(res.body.answer.split('\n').length, 15);
      for (const name of names) assert.ok(res.body.answer.includes(name));
    });

    it('should safely reject an empty answer from Groq', async () => {
      aiService.getGroqClient = () => mockGroqClient(async () =>
        completionWithContent('   ')
      );

      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ mode: 'answer', prompt: 'Explain Express.' });

      assert.strictEqual(res.status, 502);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('empty response'));
      assert.ok(!JSON.stringify(res.body).includes(process.env.GROQ_API_KEY));
    });
  });

  describe('Provider error & edge-case handling', () => {
    it('should return 503 when GROQ_API_KEY is not configured', async () => {
      delete process.env.GROQ_API_KEY;
      aiService.getGroqClient = originalGetGroqClient;

      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ description: 'Build a project' });

      assert.strictEqual(res.status, 503);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Groq API key is not configured'));
    });

    it('should return 504 when a Groq request times out', async () => {
      aiService.getGroqClient = () => mockGroqClient(async () => {
        throw providerError('Request timed out', undefined, 'APIConnectionTimeoutError');
      });
      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ description: 'Plan a complex migration' });
      assert.strictEqual(res.status, 504);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('timed out'));
    });

    it('should return a safe error when Groq fails', async () => {
      aiService.getGroqClient = () => mockGroqClient(async () => {
        throw new Error('Connection reset by peer');
      });
      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ description: 'Plan a migration' });
      assert.strictEqual(res.status, 502);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Failed to communicate with Groq'));
      assert.ok(!JSON.stringify(res.body).includes(process.env.GROQ_API_KEY));
    });

    it('should return 429 when Groq rate limits the request', async () => {
      aiService.getGroqClient = () => mockGroqClient(async () => {
        throw providerError('rate limited', 429);
      });
      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ description: 'Plan a project' });
      assert.strictEqual(res.status, 429);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('rate limit'));
    });

    it('should not expose provider errors or credentials for authentication failures', async () => {
      aiService.getGroqClient = () => mockGroqClient(async () => {
        throw providerError(`Invalid API key: ${process.env.GROQ_API_KEY}`, 401);
      });
      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ description: 'Plan a project' });
      assert.strictEqual(res.status, 502);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Groq rejected the configured API key'));
      assert.ok(!JSON.stringify(res.body).includes(process.env.GROQ_API_KEY));
    });

    it('should return 502 when the configured Groq model is unavailable', async () => {
      aiService.getGroqClient = () => mockGroqClient(async () => {
        throw providerError('model not found', 404);
      });
      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ description: 'Plan a project' });
      assert.strictEqual(res.status, 502);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Groq model'));
    });

    it('should return 502 when Groq returns malformed JSON', async () => {
      aiService.getGroqClient = () => mockGroqClient(async () =>
        completionWithContent('This is not JSON')
      );
      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ description: 'Plan a website' });
      assert.strictEqual(res.status, 502);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('malformed JSON'));
    });

    it('should return 502 when Groq returns an empty response', async () => {
      aiService.getGroqClient = () => mockGroqClient(async () => ({ choices: [] }));
      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ description: 'Plan a website' });
      assert.strictEqual(res.status, 502);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('empty response'));
    });

    it('should return 502 when Groq output fails schema validation', async () => {
      aiService.getGroqClient = () => mockGroqClient(async () =>
        completionWithContent(JSON.stringify({
          summary: 'Bad output',
          priority: 'invalid-priority',
          estimatedHours: -5,
          steps: [],
        }))
      );
      const res = await request(app)
        .post('/api/ai/plan-task')
        .send({ description: 'Plan something' });
      assert.strictEqual(res.status, 502);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('plan schema'));
      assert.ok(Array.isArray(res.body.errors));
    });
  });

  describe('AI Rate Limiting', () => {
    it('should return 429 when the AI rate limit is exceeded', async () => {
      const testApp = express();
      testApp.use(express.json());
      const strictLimiter = createAiRateLimiter({ windowMs: 60 * 1000, max: 2 });
      testApp.post('/test-ai', strictLimiter, (req, res) => res.json({ success: true }));
      testApp.use(errorMiddleware);

      assert.strictEqual((await request(testApp).post('/test-ai').send({})).status, 200);
      assert.strictEqual((await request(testApp).post('/test-ai').send({})).status, 200);
      const res = await request(testApp).post('/test-ai').send({});
      assert.strictEqual(res.status, 429);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Too many AI requests'));
    });
  });
});
