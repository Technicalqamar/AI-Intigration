import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

const frontendOrigin = 'https://codenestagent.vercel.app';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = frontendOrigin;

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

  it('fails production startup when the exact frontend origin is missing or wildcarded', () => {
    const validProductionConfig = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `process.env.NODE_ENV = 'production'; process.env.CORS_ORIGIN = ${JSON.stringify(frontendOrigin)}; await import('./src/app.js');`,
      ],
      { cwd: process.cwd(), encoding: 'utf8' }
    );
    assert.strictEqual(validProductionConfig.status, 0, validProductionConfig.stderr);

    for (const value of [
      undefined,
      'http://localhost:3000',
      '*',
      `${frontendOrigin},*`,
    ]) {
      const setup = value === undefined
        ? 'delete process.env.CORS_ORIGIN;'
        : `process.env.CORS_ORIGIN = ${JSON.stringify(value)};`;
      const result = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `process.env.NODE_ENV = 'production'; ${setup} await import('./src/app.js');`,
        ],
        { cwd: process.cwd(), encoding: 'utf8' }
      );

      assert.notStrictEqual(result.status, 0);
      assert.match(
        result.stderr,
        /CORS_ORIGIN must include https:\/\/codenestagent\.vercel\.app and must not use a wildcard in production/
      );
    }
  });
});
