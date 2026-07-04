const test = require('node:test');
const assert = require('node:assert/strict');

const { ensureGuildMembers } = require('../src/memberCache');
const {
  createGuild,
  createMember,
} = require('./helpers/mockDiscord');

function createConfig(overrides = {}) {
  return {
    memberFetchTtlSeconds: 300,
    memberFetchCacheFullRatio: 0.9,
    ...overrides,
  };
}

test('reuses in-flight fetch promise for the same guild', async () => {
  const guild = createGuild({
    initialMembers: [createMember({ id: 'u1' })],
    fetchedMembers: [
      createMember({ id: 'u1' }),
      createMember({ id: 'u2' }),
      createMember({ id: 'u3' }),
      createMember({ id: 'u4' }),
      createMember({ id: 'u5' }),
    ],
    memberCount: 5,
    fetchDelayMs: 20,
  });

  const [first, second] = await Promise.all([
    ensureGuildMembers(guild, createConfig(), { reason: 'one' }),
    ensureGuildMembers(guild, createConfig(), { reason: 'two' }),
  ]);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(guild.getFetchCalls(), 1);
});

test('does not fetch again within MEMBER_FETCH_TTL_SECONDS', async () => {
  const guild = createGuild({
    initialMembers: [createMember({ id: 'u1' })],
    fetchedMembers: [
      createMember({ id: 'u1' }),
      createMember({ id: 'u2' }),
      createMember({ id: 'u3' }),
      createMember({ id: 'u4' }),
      createMember({ id: 'u5' }),
    ],
    memberCount: 5,
  });

  const first = await ensureGuildMembers(guild, createConfig(), { reason: 'first' });
  const second = await ensureGuildMembers(guild, createConfig(), { reason: 'second' });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.fromCache, true);
  assert.equal(guild.getFetchCalls(), 1);
});

test('handles rate-limit-like error and sets retry window', async () => {
  const guild = createGuild({
    initialMembers: [createMember({ id: 'u1' })],
    fetchedMembers: [
      createMember({ id: 'u1' }),
      createMember({ id: 'u2' }),
      createMember({ id: 'u3' }),
      createMember({ id: 'u4' }),
      createMember({ id: 'u5' }),
    ],
    memberCount: 5,
    fetchError: {
      name: 'GatewayRateLimitError',
      timeout: 1000,
      message: 'Request with opcode 8 was rate limited',
    },
  });

  const first = await ensureGuildMembers(guild, createConfig(), { reason: 'rate-limit' });
  const second = await ensureGuildMembers(guild, createConfig(), { reason: 'rate-limit' });

  assert.equal(first.ok, false);
  assert.equal(first.rateLimited, true);
  assert.ok(first.retryUntil);
  assert.equal(second.ok, false);
  assert.equal(second.rateLimited, true);
  assert.equal(guild.getFetchCalls(), 1);
});

test('returns ok=false on generic fetch failure without throwing', async () => {
  const guild = createGuild({
    initialMembers: [createMember({ id: 'u1' })],
    fetchedMembers: [
      createMember({ id: 'u1' }),
      createMember({ id: 'u2' }),
      createMember({ id: 'u3' }),
      createMember({ id: 'u4' }),
      createMember({ id: 'u5' }),
    ],
    memberCount: 5,
    fetchError: new Error('generic fetch failure'),
  });

  const result = await ensureGuildMembers(guild, createConfig(), { reason: 'generic-failure' });

  assert.equal(result.ok, false);
  assert.equal(result.rateLimited, false);
  assert.match(result.error, /generic fetch failure/);
});
