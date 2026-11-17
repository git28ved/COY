import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { makeDb } from './helpers.js';

describe('app', () => {
  it('GET /health returns ok', async () => {
    const res = await request(createApp(makeDb())).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('marks responses as non-cacheable and hides the Express banner', async () => {
    const res = await request(createApp(makeDb())).get('/health');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('unknown routes → JSON 404', async () => {
    const res = await request(createApp(makeDb())).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found', code: 'NOT_FOUND' });
  });
});

describe('serving the React build (production)', () => {
  let dist: string;
  beforeEach(() => {
    dist = mkdtempSync(join(tmpdir(), 'coy-dist-'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Coy</title>');
    writeFileSync(join(dist, 'app.js'), 'console.log(1)');
  });
  afterEach(() => rmSync(dist, { recursive: true, force: true }));

  it('serves index.html, static assets, and an HTML fallback without shadowing the API', async () => {
    const app = createApp(makeDb(), { clientDist: dist });

    const home = await request(app).get('/').set('Accept', 'text/html');
    expect(home.status).toBe(200);
    expect(home.text).toContain('<title>Coy</title>');

    expect((await request(app).get('/app.js')).text).toBe('console.log(1)');

    const deep = await request(app).get('/some/page').set('Accept', 'text/html');
    expect(deep.text).toContain('<title>Coy</title>');

    const feed = await request(app).get('/feed').set('Accept', 'application/json');
    expect(feed.status).toBe(200);
    expect(feed.body).toHaveProperty('profiles');

    const missingApi = await request(app).get('/nope').set('Accept', 'application/json');
    expect(missingApi.status).toBe(404);
  });

  it('skips static serving when the build is missing', async () => {
    const app = createApp(makeDb(), { clientDist: join(dist, 'missing') });
    expect((await request(app).get('/').set('Accept', 'text/html')).status).toBe(404);
  });
});
