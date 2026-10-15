const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPdfCache } = require('../src/services/reportPdfCache');

test('simultaneous requests share one generation and later requests reuse the bytes', async () => {
  const cache = createPdfCache(); let renders = 0;
  const render = async () => { renders += 1; await new Promise(resolve => setImmediate(resolve)); return Buffer.from('PDF'); };
  const [first, second] = await Promise.all([cache.getOrCreate('one', render), cache.getOrCreate('one', render)]);
  assert.equal(renders, 1); assert.equal(first.status, 'MISS'); assert.equal(second.status, 'SHARED');
  assert.equal((await cache.getOrCreate('one', render)).status, 'HIT');
  assert.equal(renders, 1);
});
test('failed generation is retried instead of poisoning the cache', async () => {
  const cache = createPdfCache();
  await assert.rejects(cache.getOrCreate('failed', async () => { throw new Error('Rendering failed'); }));
  assert.equal((await cache.getOrCreate('failed', async () => Buffer.from('OK'))).status, 'MISS');
});
test('cache evicts least recently used documents and respects the byte limit', async () => {
  const cache = createPdfCache({ maxBytes: 6, maxEntries: 2 });
  const render = () => Buffer.from('PDF');
  await cache.getOrCreate('a', render); await cache.getOrCreate('b', render);
  await cache.getOrCreate('a', render); await cache.getOrCreate('c', render);
  assert.equal((await cache.getOrCreate('a', render)).status, 'HIT');
  assert.equal((await cache.getOrCreate('b', render)).status, 'MISS');
  await cache.getOrCreate('large', () => Buffer.alloc(20));
  assert.equal((await cache.getOrCreate('large', () => Buffer.alloc(20))).status, 'MISS');
});
test('expired documents render again', async () => {
  const cache = createPdfCache({ ttlMs: -1 });
  await cache.getOrCreate('one', () => Buffer.from('PDF'));
  assert.equal((await cache.getOrCreate('one', () => Buffer.from('PDF'))).status, 'MISS');
});
