import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED = 'true';
process.env.AI_ASSISTANT_DEV_USER_ID = 'task-assistant-test-user';
process.env.AI_RATE_LIMIT_MAX = '100';

const [{ default: app }, { Task }, { aiService }, { TaskAssistantService }, { assertAssistantConfiguration }] =
  await Promise.all([
    import('../src/app.js'),
    import('../src/models/task.model.js'),
    import('../src/services/ai.service.js'),
    import('../src/services/task-assistant.service.js'),
    import('../src/middleware/assistant-auth.middleware.js'),
  ]);

const assistantPath = '/api/ai/assistant';
const assistantUserId = process.env.AI_ASSISTANT_DEV_USER_ID;

describe('Secure task-aware AI assistant', () => {
  let mongoServer;
  let originalParseIntent;
  let originalGetGroqClient;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri('task_assistant_tests'));
    originalParseIntent = aiService.parseTaskAssistantIntent;
    originalGetGroqClient = aiService.getGroqClient;
  });

  after(async () => {
    aiService.parseTaskAssistantIntent = originalParseIntent;
    aiService.getGroqClient = originalGetGroqClient;
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    await mongoServer?.stop();
    delete process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED;
    delete process.env.AI_ASSISTANT_DEV_USER_ID;
    delete process.env.AI_RATE_LIMIT_MAX;
  });

  beforeEach(async () => {
    await Task.deleteMany({});
    aiService.parseTaskAssistantIntent = async () => ({ action: 'clarify', question: 'Please clarify.' });
  });

  const setIntent = (intent) => {
    aiService.parseTaskAssistantIntent = async () => intent;
  };

  const sendMessage = (message) =>
    request(app).post(`${assistantPath}/message`).send({ message });

  it('limits development identity to enabled non-production and refuses unsafe production configuration', async () => {
    const originalEnvironment = process.env.NODE_ENV;
    const originalEnabled = process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED;
    const originalUser = process.env.AI_ASSISTANT_DEV_USER_ID;
    try {
      process.env.NODE_ENV = 'development';
      process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED = 'false';
      assert.doesNotThrow(() => assertAssistantConfiguration());

      process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED = 'true';
      process.env.AI_ASSISTANT_DEV_USER_ID = 'configured-user';
      assert.doesNotThrow(() => assertAssistantConfiguration());

      process.env.NODE_ENV = 'production';
      assert.throws(() => assertAssistantConfiguration(), /cannot be enabled in production/);
    } finally {
      if (originalEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalEnvironment;
      if (originalEnabled === undefined) delete process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED;
      else process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED = originalEnabled;
      if (originalUser === undefined) delete process.env.AI_ASSISTANT_DEV_USER_ID;
      else process.env.AI_ASSISTANT_DEV_USER_ID = originalUser;
    }
  });

  it('returns the unavailable response without configuration and reaches the handler when explicitly configured', async () => {
    const originalEnabled = process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED;
    const originalUser = process.env.AI_ASSISTANT_DEV_USER_ID;
    try {
      delete process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED;
      const unavailable = await sendMessage('Show my tasks.');
      assert.strictEqual(unavailable.status, 404);
      assert.strictEqual(unavailable.body.success, false);
      assert.strictEqual(unavailable.body.message, 'Task assistant is not available.');

      process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED = 'true';
      process.env.AI_ASSISTANT_DEV_USER_ID = assistantUserId;
      await Task.create({ ownerId: assistantUserId, title: 'Assistant-owned task' });
      setIntent({ action: 'list' });
      const available = await sendMessage('Show my tasks.');

      assert.strictEqual(available.status, 200);
      assert.strictEqual(available.body.success, true);
      assert.strictEqual(available.body.assistant.action.type, 'list');
      assert.deepStrictEqual(
        available.body.assistant.action.tasks.map((task) => task.title),
        ['Assistant-owned task']
      );
    } finally {
      if (originalEnabled === undefined) delete process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED;
      else process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED = originalEnabled;
      if (originalUser === undefined) delete process.env.AI_ASSISTANT_DEV_USER_ID;
      else process.env.AI_ASSISTANT_DEV_USER_ID = originalUser;
    }
  });

  it('ignores a client-supplied user id and returns actual owned records and counts only', async () => {
    await Task.create([
      { ownerId: assistantUserId, title: 'Owned pending', status: 'pending' },
      { ownerId: assistantUserId, title: 'Owned completed', status: 'completed' },
      { ownerId: 'another-user', title: 'Private other task', status: 'pending' },
      { title: 'Legacy unowned task', status: 'pending' },
    ]);

    setIntent({ action: 'list', filter: { status: 'pending' } });
    const listResponse = await request(app)
      .post(`${assistantPath}/message`)
      .send({ message: 'Show my pending tasks' });

    assert.strictEqual(listResponse.status, 200);
    assert.deepStrictEqual(
      listResponse.body.assistant.action.tasks.map((task) => task.title),
      ['Owned pending']
    );
    const forgedIdentity = await request(app)
      .post(`${assistantPath}/message`)
      .send({ message: 'Show my pending tasks', userId: 'another-user' });
    assert.strictEqual(forgedIdentity.status, 400);

    setIntent({ action: 'count' });
    const countResponse = await sendMessage('How many tasks have I created?');
    assert.deepStrictEqual(countResponse.body.assistant.action.counts, {
      total: 2,
      pending: 1,
      inProgress: 0,
      completed: 1,
      overdue: 0,
    });
    const foreignTask = await Task.findOne({ ownerId: 'another-user' });
    const foreignGet = await request(app).get(`/api/tasks/${foreignTask._id}`);
    const foreignUpdate = await request(app)
      .put(`/api/tasks/${foreignTask._id}`)
      .send({ status: 'completed' });
    const foreignDelete = await request(app).delete(`/api/tasks/${foreignTask._id}`);
    assert.strictEqual(foreignGet.status, 404);
    assert.strictEqual(foreignUpdate.status, 404);
    assert.strictEqual(foreignDelete.status, 404);
    assert.strictEqual(foreignTask.status, 'pending');
    assert.ok(await Task.exists({ _id: foreignTask._id }));

    const data = await Task.findOne({ title: 'Owned pending' }).select('+ownerId');
    assert.strictEqual(data.ownerId, assistantUserId);
    assert.strictEqual(listResponse.body.assistant.action.tasks[0].ownerId, undefined);
  });

  it('returns task reports based on saved records and actual overdue/status fields', async () => {
    await Task.create([
      { ownerId: assistantUserId, title: 'Past due', status: 'in-progress', dueDate: new Date('2020-01-01') },
      { ownerId: assistantUserId, title: 'Done on time', status: 'completed', dueDate: new Date('2020-01-01') },
    ]);
    setIntent({ action: 'report', filter: { overdue: true } });

    const response = await sendMessage('Give me a report of my overdue tasks.');

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.assistant.action.total, 1);
    assert.strictEqual(response.body.assistant.action.overdue, 1);
    assert.strictEqual(response.body.assistant.action.tasks[0].title, 'Past due');
  });

  it('creates a validated task owned by the configured identity', async () => {
    setIntent({
      action: 'create',
      title: 'Finish my portfolio',
      description: 'Polish and publish my work samples.',
      status: 'pending',
      dueDate: '2030-05-10T00:00:00.000Z',
    });
    const response = await sendMessage('Create a task to finish my portfolio tomorrow.');

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.assistant.action.status, 'completed');
    const task = await Task.findById(response.body.assistant.action.task.id).select('+ownerId');
    assert.strictEqual(task.title, 'Finish my portfolio');
    assert.strictEqual(task.ownerId, assistantUserId);
    assert.strictEqual(task.status, 'pending');
    assert.strictEqual(task.dueDate.toISOString(), '2030-05-10T00:00:00.000Z');
  });

  it('rejects invalid provider action data without creating a task', async () => {
    setIntent({ action: 'create', title: 'Bad status', status: 'archived' });
    const response = await sendMessage('Create a task named Bad status.');

    assert.strictEqual(response.status, 502);
    assert.strictEqual(await Task.countDocuments({}), 0);
  });

  it('updates only the uniquely matched owned task and clarifies ambiguous matches', async () => {
    const [ownTask] = await Task.create([
      { ownerId: assistantUserId, title: 'Portfolio' },
      { ownerId: assistantUserId, title: 'Portfolio draft' },
      { ownerId: 'another-user', title: 'Private portfolio' },
    ]);
    setIntent({
      action: 'update',
      taskTitle: 'Portfolio',
      updates: { status: 'completed' },
    });

    const response = await sendMessage('Mark my portfolio task as completed.');
    assert.strictEqual(response.body.assistant.action.status, 'completed');
    assert.strictEqual(await Task.findById(ownTask._id).then((task) => task.status), 'completed');

    setIntent({
      action: 'update',
      taskTitle: 'port',
      updates: { status: 'pending' },
    });
    const ambiguousResponse = await sendMessage('Update my portfolio task to pending.');
    assert.strictEqual(ambiguousResponse.body.assistant.action.status, 'not_performed');
    assert.strictEqual(ambiguousResponse.body.assistant.action.candidates.length, 2);
    assert.strictEqual(await Task.countDocuments({ status: 'pending', ownerId: assistantUserId }), 1);
  });

  it('does not perform mutations when the natural-language intent is not explicit', async () => {
    setIntent({ action: 'delete', taskTitle: 'Portfolio' });
    const response = await sendMessage('What happens if I delete my portfolio task?');

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.assistant.action.status, 'not_performed');
    assert.strictEqual(await Task.countDocuments({}), 0);
  });

  it('requires a separate valid, same-user confirmation before deletion and rejects reuse', async () => {
    const task = await Task.create({ ownerId: assistantUserId, title: 'Old meeting' });
    setIntent({ action: 'delete', taskTitle: 'Old meeting' });
    const requestResponse = await sendMessage('Delete the old meeting task.');
    const confirmation = requestResponse.body.assistant.action.confirmation;

    assert.strictEqual(requestResponse.body.assistant.action.status, 'confirmation_required');
    assert.ok(await Task.exists({ _id: task._id }));

    await assert.rejects(
      (await import('../src/services/task-assistant.service.js'))
        .taskAssistantService.confirmDelete('another-user', confirmation.token),
      /invalid, expired, or already used/
    );

    const confirmationResponse = await request(app)
      .post(`${assistantPath}/confirm-delete`)
      .send({ confirmationToken: confirmation.token, confirm: true });

    assert.strictEqual(confirmationResponse.status, 200);
    assert.strictEqual(confirmationResponse.body.assistant.action.status, 'completed');
    assert.strictEqual(await Task.exists({ _id: task._id }), null);
    await assert.rejects(
      (await import('../src/services/task-assistant.service.js'))
        .taskAssistantService.confirmDelete(assistantUserId, confirmation.token),
      /invalid, expired, or already used/
    );
  });

  it('rejects invalid, expired, reused and unconfirmed deletion requests', async () => {
    const task = await Task.create({ ownerId: assistantUserId, title: 'Soon deleted' });
    const shortLivedAssistant = new TaskAssistantService({ confirmationTtlMs: 5 });
    const deletionIntent = { action: 'delete', taskTitle: 'Soon deleted' };
    const pending = await shortLivedAssistant.requestDeleteConfirmation(assistantUserId, deletionIntent);
    const token = pending.action.confirmation.token;

    await assert.rejects(shortLivedAssistant.confirmDelete(assistantUserId, 'a'.repeat(64)));
    await new Promise((resolve) => setTimeout(resolve, 10));
    await assert.rejects(shortLivedAssistant.confirmDelete(assistantUserId, token), /invalid, expired/);

    const noExplicitConfirmation = await request(app)
      .post(`${assistantPath}/confirm-delete`)
      .send({ confirmationToken: 'a'.repeat(64), confirm: false });
    assert.strictEqual(noExplicitConfirmation.status, 400);
    assert.ok(await Task.exists({ _id: task._id }));
  });

  it('rejects malformed messages and does not claim success after provider failures', async () => {
    const empty = await request(app).post(`${assistantPath}/message`).send({ message: ' ' });
    assert.strictEqual(empty.status, 400);

    aiService.parseTaskAssistantIntent = originalParseIntent;
    aiService.getGroqClient = () => ({
      chat: {
        completions: {
          create: async () => {
            throw Object.assign(new Error('secret provider details'), { status: 429 });
          },
        },
      },
    });
    const providerFailure = await sendMessage('Create a task to publish my portfolio.');
    assert.strictEqual(providerFailure.status, 429);
    assert.strictEqual(providerFailure.body.success, false);
    assert.strictEqual(
      providerFailure.body.message,
      'AI service rate limit reached with provider. Please try again shortly.'
    );
    assert.ok(!JSON.stringify(providerFailure.body).includes('secret provider details'));
    assert.strictEqual(await Task.countDocuments({}), 0);
    aiService.getGroqClient = originalGetGroqClient;
  });

  it('returns a safe server error when task database operations fail', async () => {
    const originalFind = Task.find;
    Task.find = () => {
      throw new Error('private database connection details');
    };
    setIntent({ action: 'list' });

    let response;
    try {
      response = await sendMessage('Show my tasks.');
    } finally {
      Task.find = originalFind;
    }
    assert.strictEqual(response.status, 500);
    assert.strictEqual(response.body.success, false);
    assert.strictEqual(
      response.body.message,
      'Task assistant could not complete the database operation.'
    );
    assert.ok(!JSON.stringify(response.body).includes('private database connection details'));
  });

  it('leaves legacy ownerless tasks intact and existing public CRUD responses unchanged', async () => {
    const [legacyTask] = await Task.create([{ title: 'Existing legacy task' }]);
    setIntent({ action: 'list' });

    const assistantResponse = await sendMessage('Show my tasks.');
    const createdTask = await request(app)
      .post('/api/tasks')
      .send({ title: 'Task created via existing CRUD' });
    assert.strictEqual(createdTask.status, 201);
    assert.strictEqual(createdTask.body.success, true);
    assert.strictEqual(createdTask.body.data.ownerId, undefined);
    const scopedList = await request(app).get('/api/tasks');
    assert.deepStrictEqual(
      scopedList.body.data.map((task) => task.title),
      ['Task created via existing CRUD']
    );

    process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED = 'false';
    const publicList = await request(app).get('/api/tasks');
    process.env.AI_ASSISTANT_DEV_IDENTITY_ENABLED = 'true';

    assert.strictEqual(assistantResponse.body.assistant.action.tasks.length, 0);
    assert.strictEqual(publicList.status, 200);
    assert.ok(publicList.body.data.some((task) => task._id === String(legacyTask._id)));
    assert.ok(await Task.exists({ _id: legacyTask._id }));
  });
});
