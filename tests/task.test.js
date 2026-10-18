import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';

import app from '../src/app.js';
import { Task } from '../src/models/task.model.js';

describe('Task REST API & General Endpoints', () => {
  let mongoServer;

  before(async () => {
    process.env.NODE_ENV = 'test';
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await Task.deleteMany({});
  });

  describe('GET / (Health Check)', () => {
    it('should return 200 and healthy status with database connection info', async () => {
      const res = await request(app).get('/');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, 'Task Manager REST API is running');
      assert.strictEqual(res.body.data.status, 'healthy');
      assert.strictEqual(res.body.data.database.status, 'connected');
      assert.strictEqual(res.body.data.database.healthy, true);
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a new task with default status and return 201', async () => {
      const payload = {
        title: 'Complete backend assessment',
        description: 'Implement Express REST API with MongoDB and Groq',
      };

      const res = await request(app)
        .post('/api/tasks')
        .send(payload);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.title, payload.title);
      assert.strictEqual(res.body.data.description, payload.description);
      assert.strictEqual(res.body.data.status, 'pending');
      assert.ok(res.body.data._id);
      assert.ok(res.body.data.createdAt);
      assert.ok(res.body.data.updatedAt);
    });

    it('should create a task with custom status and valid dueDate', async () => {
      const dueDate = new Date(Date.now() + 86400000).toISOString();
      const payload = {
        title: 'Review pull request',
        status: 'in-progress',
        dueDate,
      };

      const res = await request(app)
        .post('/api/tasks')
        .send(payload);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.status, 'in-progress');
      assert.strictEqual(res.body.data.description, '');
      assert.ok(res.body.data.dueDate);
    });

    it('should reject creation when title is missing', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ description: 'Missing title' });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(Array.isArray(res.body.errors));
      assert.ok(res.body.errors.some((e) => e.field === 'title'));
    });

    it('should reject creation when title is an empty string or whitespace', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ title: '   ' });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some((e) => e.field === 'title'));
    });

    it('should reject creation with an invalid status enum value', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ title: 'Valid title', status: 'archived' });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some((e) => e.field === 'status'));
    });

    it('should reject creation with a malformed date string', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ title: 'Valid title', dueDate: 'not-a-date' });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some((e) => e.field === 'dueDate'));
    });

    it('should reject creation with unsupported/injected fields', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({
          title: 'Valid title',
          unsupportedField: 'malicious',
          _id: '507f1f77bcf86cd799439011',
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });
  });

  describe('GET /api/tasks', () => {
    it('should retrieve an empty list when no tasks exist', async () => {
      const res = await request(app).get('/api/tasks');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.deepStrictEqual(res.body.data, []);
    });

    it('should retrieve all tasks ordered by creation date descending', async () => {
      await Task.create([
        { title: 'First Task' },
        { title: 'Second Task' },
      ]);

      const res = await request(app).get('/api/tasks');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.length, 2);
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('should retrieve an existing task by valid ID', async () => {
      const task = await Task.create({ title: 'Target Task', status: 'pending' });

      const res = await request(app).get(`/api/tasks/${task._id}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data._id, task._id.toString());
      assert.strictEqual(res.body.data.title, 'Target Task');
    });

    it('should return 400 for an invalid ObjectId format', async () => {
      const res = await request(app).get('/api/tasks/not-a-valid-id');

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Validation failed'));
    });

    it('should return 404 for a valid format but non-existent ID', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const res = await request(app).get(`/api/tasks/${nonExistentId}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('not found'));
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('should update allowed fields on an existing task', async () => {
      const task = await Task.create({ title: 'Initial Title', status: 'pending' });

      const res = await request(app)
        .put(`/api/tasks/${task._id}`)
        .send({
          title: 'Updated Title',
          status: 'completed',
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.title, 'Updated Title');
      assert.strictEqual(res.body.data.status, 'completed');

      const inDb = await Task.findById(task._id);
      assert.strictEqual(inDb.title, 'Updated Title');
      assert.strictEqual(inDb.status, 'completed');
    });

    it('should reject update with empty body', async () => {
      const task = await Task.create({ title: 'Task' });

      const res = await request(app)
        .put(`/api/tasks/${task._id}`)
        .send({});

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('should reject update with invalid status', async () => {
      const task = await Task.create({ title: 'Task' });

      const res = await request(app)
        .put(`/api/tasks/${task._id}`)
        .send({ status: 'invalid-status' });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('should reject update containing unsupported or internal fields like _id', async () => {
      const task = await Task.create({ title: 'Task' });

      const res = await request(app)
        .put(`/api/tasks/${task._id}`)
        .send({
          title: 'New Title',
          _id: '507f1f77bcf86cd799439099',
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('should return 404 when updating non-existent task', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .put(`/api/tasks/${nonExistentId}`)
        .send({ title: 'Updated Title' });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete an existing task by ID and return 200', async () => {
      const task = await Task.create({ title: 'Task To Delete' });

      const res = await request(app).delete(`/api/tasks/${task._id}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.id, task._id.toString());

      const inDb = await Task.findById(task._id);
      assert.strictEqual(inDb, null);
    });

    it('should return 400 for invalid ID on delete', async () => {
      const res = await request(app).delete('/api/tasks/invalid-id');

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('should return 404 when deleting non-existent task', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const res = await request(app).delete(`/api/tasks/${nonExistentId}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
    });
  });

  describe('Error handling & Unknown routes', () => {
    it('should return 404 for unknown endpoints', async () => {
      const res = await request(app).get('/api/unknown-endpoint');

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Route not found'));
    });

    it('should return 400 for malformed JSON request bodies', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .send('{"title": "Unclosed string');

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Malformed JSON payload'));
    });
  });
});
