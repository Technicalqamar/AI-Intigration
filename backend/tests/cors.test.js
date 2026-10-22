import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

const frontendOrigin = 'https://codenestagent.vercel.app';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000,http://localhost:5173';

const { default: app } = await import('../src/app.js');

describe('Production frontend CORS configuration', () => {
  let mongoServer;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri('cors_tests'));
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    await mongoServer?.stop();
    delete process.env.CORS_ORIGIN;
  });

  it('returns the exact allowed origin header on task API responses', async () => {
    const response = await request(app)
      .get('/api/tasks')
      .set('Origin', frontendOrigin);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers['access-control-allow-origin'], frontendOrigin);
    assert.deepStrictEqual(response.body.data, []);
  });

  it('handles GET preflight requests from the configured frontend origin', async () => {
    const response = await request(app)
      .options('/api/tasks')
      .set('Origin', frontendOrigin)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization');

    assert.strictEqual(response.status, 204);
    assert.strictEqual(response.headers['access-control-allow-origin'], frontendOrigin);
    assert.match(response.headers['access-control-allow-methods'], /GET/);
    assert.match(response.headers['access-control-allow-headers'], /Authorization/i);
  });

  it('does not return CORS headers for a disallowed origin', async () => {
    const response = await request(app)
      .get('/api/tasks')
      .set('Origin', 'https://untrusted.example');

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers['access-control-allow-origin'], undefined);
  });

  it('keeps the production frontend allowlisted when CORS_ORIGIN contains only local origins', () => {
    const productionWithLocalOrigins = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "process.env.NODE_ENV = 'production'; process.env.CORS_ORIGIN = 'http://localhost:3000,http://localhost:5173'; await import('./src/app.js');",
      ],
      { cwd: process.cwd(), encoding: 'utf8' }
    );
    assert.strictEqual(productionWithLocalOrigins.status, 0, productionWithLocalOrigins.stderr);

    for (const value of ['*', `http://localhost:3000,*`]) {
      const result = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `process.env.NODE_ENV = 'production'; process.env.CORS_ORIGIN = ${JSON.stringify(value)}; await import('./src/app.js');`,
        ],
        { cwd: process.cwd(), encoding: 'utf8' }
      );

      assert.notStrictEqual(result.status, 0);
      assert.match(result.stderr, /CORS_ORIGIN must not use a wildcard in production/);
    }
  });
});
