import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHandler, validateEvent } from './handler.mjs';

const good = { name: 'export_png', ts: 1700000000000, session: 'a1b2c3d4e5f6', prop: 'signal' };
const req = (method, body) => ({ requestContext: { http: { method } }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('accepts a valid event and stores it', async () => {
  const stored = [];
  const res = await createHandler(async (e) => stored.push(e))(req('POST', good));
  assert.equal(res.statusCode, 204);
  assert.deepEqual(stored, [good]);
});

test('rejects unknown event names, bad sessions and extra-long props', () => {
  assert.equal(validateEvent({ ...good, name: 'steal_data' }), null);
  assert.equal(validateEvent({ ...good, session: 'not-hex' }), null);
  assert.equal(validateEvent({ ...good, prop: 'x'.repeat(33) }), null);
});

test('drops unexpected fields so no personal data can be stored', () => {
  assert.deepEqual(validateEvent({ ...good, email: 'a@b.c' }), good);
});

test('rejects non-POST, bad JSON and oversized bodies', async () => {
  const h = createHandler(async () => {});
  assert.equal((await h(req('GET', ''))).statusCode, 405);
  assert.equal((await h(req('POST', '{nope'))).statusCode, 400);
  assert.equal((await h(req('POST', 'x'.repeat(2000)))).statusCode, 413);
});
